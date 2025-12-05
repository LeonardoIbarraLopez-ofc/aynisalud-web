import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, db, isAdmin, isClinician, auditLog, toIsoString, sanitizeForFirestore, getServerTimestamp } from './utils';
import { makeHttpHandler } from './httpHelpers';

type UserRole = 'admin' | 'doctor' | 'specialist' | 'receptionist' | 'patient';

type TimelineType =
  | 'consultation_note'
  | 'lab_result'
  | 'prescription'
  | 'imaging_study'
  | 'procedure'
  | 'vital_sign'
  | 'document'
  | 'clinical_note';

type TimelinePresentationType =
  | 'ConsultationNote'
  | 'LabResult'
  | 'Prescription'
  | 'ImageStudy'
  | 'Procedure'
  | 'Vital'
  | 'Document';

interface SoapNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

interface PrescriptionItem {
  id?: string;
  medicationName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

interface LabOrderItem {
  id?: string;
  testName: string;
  details?: string;
}

interface VitalSignItem {
  id?: string;
  name: string;
  value: string;
  unit?: string;
}

interface TimelineEventDoc {
  type: TimelineType;
  title: string;
  summary: string;
  details?: string;
  tags?: string[];
  appointmentId?: string | null;
  status?: 'draft' | 'final' | 'signed';
  performedAt: FirebaseFirestore.Timestamp;
  soapNote?: SoapNote;
  prescriptions?: PrescriptionItem[];
  labOrders?: LabOrderItem[];
  vitals?: VitalSignItem[];
  attachments?: Array<{ id?: string; name?: string; url?: string; type?: string }>; // optional future use
  actor: {
    uid: string;
    name?: string;
    role?: string | null;
    email?: string | null;
  };
  createdAt: FirebaseFirestore.FieldValue | Date;
  updatedAt: FirebaseFirestore.FieldValue | Date;
}

const TIMELINE_TYPE_MAP: Record<TimelineType, TimelinePresentationType> = {
  consultation_note: 'ConsultationNote',
  clinical_note: 'ConsultationNote',
  lab_result: 'LabResult',
  prescription: 'Prescription',
  imaging_study: 'ImageStudy',
  procedure: 'Procedure',
  vital_sign: 'Vital',
  document: 'Document',
};

type RawPatientDoc = {
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  idNumber?: string;
  contactInfo?: { email?: string; phone?: string; address?: string };
  insuranceInfo?: any[];
  allergies?: string[];
  chronicConditions?: string[];
  avatarUrl?: string;
  authUid?: string;
  clinicId?: string | null;
  searchKeywords?: string[];
};

interface ClinicalSnapshotItem {
  type: 'diagnosis' | 'allergy' | 'medication' | 'vital' | 'note';
  title: string;
  details: string;
  isCritical?: boolean;
  date?: string;
  source?: string;
  tags?: string[];
}

interface ClinicalTimelineEvent {
  id: string;
  type: TimelinePresentationType;
  date: string;
  title: string;
  summary: string;
  actor: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

function ensureReadAccess(patient: RawPatientDoc, patientId: string, callerUid: string, token: any) {
  const allowed = (patient.authUid && patient.authUid === callerUid) || isAdmin(token);
  if (allowed) {
    return;
  }
  const authorizedClinicians = Array.isArray((patient as any).authorizedClinicians)
    ? (patient as any).authorizedClinicians
    : [];
  if (authorizedClinicians.includes(callerUid) || isClinician(token)) {
    return;
  }
  throw new functions.https.HttpsError('permission-denied', 'Not authorized to read EHR for this patient');
}

function ensureWriteAccess(patient: RawPatientDoc, callerUid: string, token: any) {
  const allowed = isClinician(token) || isAdmin(token);
  if (allowed) {
    return;
  }
  if (patient.authUid && patient.authUid === callerUid) {
    return;
  }
  throw new functions.https.HttpsError('permission-denied', 'Not authorized to update EHR for this patient');
}

function normalizePatient(docId: string, data: RawPatientDoc) {
  return {
    id: docId,
    firstName: String(data?.firstName || ''),
    lastName: String(data?.lastName || ''),
    dob: String(data?.dob || ''),
    gender: ['male', 'female', 'other'].includes(String(data?.gender)) ? String(data?.gender) : 'other',
    idNumber: String(data?.idNumber || ''),
    contactInfo: {
      email: String(data?.contactInfo?.email || ''),
      phone: String(data?.contactInfo?.phone || ''),
      address: String(data?.contactInfo?.address || ''),
    },
    insuranceInfo: Array.isArray(data?.insuranceInfo) ? data.insuranceInfo : [],
    allergies: Array.isArray(data?.allergies) ? data.allergies : [],
    chronicConditions: Array.isArray(data?.chronicConditions) ? data.chronicConditions : [],
    avatarUrl: data?.avatarUrl || '',
  };
}

function toTimestamp(value?: string): FirebaseFirestore.Timestamp {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return admin.firestore.Timestamp.fromDate(parsed);
    }
  }
  return admin.firestore.Timestamp.fromDate(new Date());
}

function sanitizeStringArray(values: any): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(item => String(item || '').trim())
    .filter(item => item.length > 0);
}

function sanitizePrescriptions(values: any): PrescriptionItem[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(item => ({
      id: item?.id ? String(item.id) : undefined,
      medicationName: String(item?.medicationName || ''),
      dosage: item?.dosage ? String(item.dosage) : undefined,
      frequency: item?.frequency ? String(item.frequency) : undefined,
      duration: item?.duration ? String(item.duration) : undefined,
      notes: item?.notes ? String(item.notes) : undefined,
    }))
    .filter(item => item.medicationName.length > 0);
}

function sanitizeLabOrders(values: any): LabOrderItem[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(item => ({
      id: item?.id ? String(item.id) : undefined,
      testName: String(item?.testName || ''),
      details: item?.details ? String(item.details) : undefined,
    }))
    .filter(item => item.testName.length > 0);
}

function sanitizeVitals(values: any): VitalSignItem[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(item => ({
      id: item?.id ? String(item.id) : undefined,
      name: String(item?.name || ''),
      value: String(item?.value || ''),
      unit: item?.unit ? String(item.unit) : undefined,
    }))
    .filter(item => item.name.length > 0 && item.value.length > 0);
}

function sanitizeSoapNote(value: any): SoapNote | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const subject = value.subjective ? String(value.subjective) : undefined;
  const objective = value.objective ? String(value.objective) : undefined;
  const assessment = value.assessment ? String(value.assessment) : undefined;
  const plan = value.plan ? String(value.plan) : undefined;
  if (subject || objective || assessment || plan) {
    return { subjective: subject, objective, assessment, plan };
  }
  return undefined;
}

function mapTimelineEvent(doc: FirebaseFirestore.QueryDocumentSnapshot): ClinicalTimelineEvent | null {
  const data = doc.data() as any;
  const rawType: TimelineType = (String(data?.type || '').toLowerCase() as TimelineType) || 'clinical_note';
  const presentationType = TIMELINE_TYPE_MAP[rawType] || 'ConsultationNote';

  const performedAt = toIsoString(data?.performedAt) || toIsoString(data?.date) || new Date().toISOString();
  const actorName = String(data?.actor?.name || data?.actorName || 'Profesional de salud');

  const metadata: Record<string, any> = {};
  if (data?.details) metadata.details = String(data.details);
  if (data?.soapNote) metadata.soapNote = data.soapNote;
  if (Array.isArray(data?.prescriptions)) metadata.prescriptions = data.prescriptions;
  if (Array.isArray(data?.labOrders)) metadata.labOrders = data.labOrders;
  if (Array.isArray(data?.vitals)) metadata.vitals = data.vitals;
  if (Array.isArray(data?.attachments)) metadata.attachments = data.attachments;
  if (data?.appointmentId) metadata.appointmentId = data.appointmentId;
  if (data?.status) metadata.status = data.status;

  return {
    id: doc.id,
    type: presentationType,
    date: performedAt,
    title: String(data?.title || 'Registro clínico'),
    summary: String(data?.summary || ''),
    actor: actorName,
    tags: sanitizeStringArray(data?.tags),
    metadata,
  };
}

function buildSnapshot(patient: ReturnType<typeof normalizePatient>, timeline: ClinicalTimelineEvent[]): ClinicalSnapshotItem[] {
  const snapshot: ClinicalSnapshotItem[] = [];

  patient.chronicConditions
    .filter(condition => condition.trim().length > 0)
    .forEach(condition => {
      snapshot.push({
        type: 'diagnosis',
        title: condition,
        details: 'Condición crónica registrada.',
        isCritical: false,
      });
    });

  patient.allergies
    .filter(allergy => allergy.trim().length > 0)
    .forEach(allergy => {
      snapshot.push({
        type: 'allergy',
        title: allergy,
        details: 'Alergia reportada por el paciente.',
        isCritical: true,
      });
    });

  const latestPrescription = timeline.find(event => event.type === 'Prescription' && event.metadata?.prescriptions?.length);
  if (latestPrescription) {
    const meds = latestPrescription.metadata?.prescriptions as PrescriptionItem[];
    const details = meds
      .map(item => {
        const pieces = [item.medicationName];
        if (item.dosage) pieces.push(item.dosage);
        if (item.frequency) pieces.push(item.frequency);
        return pieces.join(' • ');
      })
      .join('\n');
    snapshot.push({
      type: 'medication',
      title: 'Medicaciones recientes',
      details: details || 'Sin detalles de prescripción.',
      date: latestPrescription.date,
      source: latestPrescription.actor,
    });
  }

  const latestLab = timeline.find(event => event.type === 'LabResult');
  if (latestLab) {
    snapshot.push({
      type: 'note',
      title: latestLab.title,
      details: latestLab.summary,
      date: latestLab.date,
      source: latestLab.actor,
      tags: latestLab.tags,
    });
  }

  const latestVital = timeline.find(event => event.type === 'Vital' && event.metadata?.vitals?.length);
  if (latestVital) {
    const vitals = latestVital.metadata?.vitals as VitalSignItem[];
    const details = vitals.map(item => `${item.name}: ${item.value}${item.unit ? ` ${item.unit}` : ''}`).join(' • ');
    snapshot.push({
      type: 'vital',
      title: 'Signos vitales recientes',
      details: details || latestVital.summary,
      date: latestVital.date,
      source: latestVital.actor,
    });
  }

  if (snapshot.length === 0) {
    snapshot.push({
      type: 'note',
      title: 'Sin registros clínicos',
      details: 'Aún no se han agregado eventos clínicos al historial.',
    });
  }

  return snapshot;
}

const getPatientEhrHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  let patientId = String(data?.patientId || '').trim();
  const limitRaw = Number(data?.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 200;
  const since = data?.since ? new Date(String(data.since)) : null;

  let patientDocSnapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;

  if (!patientId && token?.role === 'patient') {
    const ownPatientQuery = await db
      .collection('patients')
      .where('authUid', '==', uid)
      .limit(1)
      .get();
    if (!ownPatientQuery.empty) {
      patientDocSnapshot = ownPatientQuery.docs[0];
      patientId = ownPatientQuery.docs[0].id;
    }
  }

  if (!patientId) {
    throw new functions.https.HttpsError('invalid-argument', 'patientId required');
  }

  if (!patientDocSnapshot) {
    patientDocSnapshot = await db.doc(`patients/${patientId}`).get();
  }

  if (!patientDocSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'patient not found');
  }

  const patientData = patientDocSnapshot.data() as RawPatientDoc;
  ensureReadAccess(patientData, patientId, uid as string, token);

  await auditLog(uid as string, 'read_ehr', 'patients', patientId, { limit, since: since ? since.toISOString() : null });

  let query: FirebaseFirestore.Query = db
    .collection(`patients/${patientId}/timeline`)
    .orderBy('performedAt', 'desc')
    .limit(limit);

  if (since) {
    query = query.where('performedAt', '>=', since);
  }

  const timelineSnap = await query.get();
  const timeline = timelineSnap.docs
    .map(mapTimelineEvent)
    .filter((event): event is ClinicalTimelineEvent => !!event);

  const patient = normalizePatient(patientId, patientData);
  const snapshot = buildSnapshot(patient, timeline);

  const patientDocMeta = patientDocSnapshot as FirebaseFirestore.DocumentSnapshot;
  const fallbackLastUpdated =
    toIsoString((patientDocMeta as any)?.updateTime) ||
    toIsoString((patientDocMeta as any)?.createTime) ||
    new Date().toISOString();

  const stats = {
    totalEvents: timelineSnap.size,
    lastUpdated:
      timeline.length > 0
        ? timeline[0].date
        : fallbackLastUpdated,
  };

  return {
    patientId,
    patient,
    snapshot,
    timeline,
    stats,
  };
};

const addEhrEventHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  const patientId = String(data?.patientId || '').trim();
  const eventPayload = data?.event || {};

  if (!patientId) {
    throw new functions.https.HttpsError('invalid-argument', 'patientId required');
  }
  if (!eventPayload || typeof eventPayload !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'event payload required');
  }

  const typeRaw = String(eventPayload.type || '').toLowerCase();
  const allowedTypes: TimelineType[] = [
    'consultation_note',
    'clinical_note',
    'lab_result',
    'prescription',
    'imaging_study',
    'procedure',
    'vital_sign',
    'document',
  ];
  if (!allowedTypes.includes(typeRaw as TimelineType)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported event type');
  }

  const patientSnap = await db.doc(`patients/${patientId}`).get();
  if (!patientSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'patient not found');
  }

  const patientData = patientSnap.data() as RawPatientDoc;
  ensureWriteAccess(patientData, uid as string, token);

  const actorSnap = await db.doc(`users/${uid}`).get().catch(() => null);
  const actorData = actorSnap && actorSnap.exists ? actorSnap.data() : null;

  const soapNote = sanitizeSoapNote(eventPayload.soapNote);
  const prescriptions = sanitizePrescriptions(eventPayload.prescriptions);
  const labOrders = sanitizeLabOrders(eventPayload.labOrders);
  const vitals = sanitizeVitals(eventPayload.vitals);
  const tags = sanitizeStringArray(eventPayload.tags);

  const eventDoc: TimelineEventDoc = {
    type: (typeRaw as TimelineType) || 'clinical_note',
    title: String(eventPayload.title || 'Registro clínico'),
    summary: String(eventPayload.summary || ''),
    details: eventPayload.details ? String(eventPayload.details) : undefined,
    tags,
    appointmentId: eventPayload.appointmentId ? String(eventPayload.appointmentId) : null,
    status: eventPayload.status ? String(eventPayload.status) as 'draft' | 'final' | 'signed' : 'final',
    performedAt: toTimestamp(eventPayload.performedAt),
    soapNote,
    prescriptions,
    labOrders,
    vitals,
    attachments: Array.isArray(eventPayload.attachments) ? eventPayload.attachments : undefined,
    actor: {
      uid: uid as string,
      name: actorData?.name || String(eventPayload.actorName || ''),
      role: token?.role || null,
      email: actorData?.email || null,
    },
    createdAt: getServerTimestamp(),
    updatedAt: getServerTimestamp(),
  };

  const eventId = uuidv4();
  const timelineRef = db.doc(`patients/${patientId}/timeline/${eventId}`);
  const searchableRef = db.collection('ehrEvents_searchable').doc(eventId);

  const batch = db.batch();
  batch.set(timelineRef, sanitizeForFirestore(eventDoc));

  const searchableDoc = sanitizeForFirestore({
    eventId,
    patientId,
    clinicId: patientData?.clinicId || null,
    date: eventDoc.performedAt,
    type: eventDoc.type,
    code: eventPayload.code ? String(eventPayload.code) : null,
    actorDoctorId: uid,
    createdAt: getServerTimestamp(),
    title: eventDoc.title,
    summary: eventDoc.summary,
    tags,
  });
  batch.set(searchableRef, searchableDoc);

  await batch.commit();

  await auditLog(uid as string, 'create_ehr_event', 'patients', patientId, {
    eventId,
    type: eventDoc.type,
    appointmentId: eventDoc.appointmentId || null,
  });

  return {
    eventId,
    patientId,
  };
};

export const getPatientEhr = functions.https.onCall(getPatientEhrHandler);
export const getPatientEhrHttp = makeHttpHandler(getPatientEhrHandler);
export const addEhrEvent = functions.https.onCall(addEhrEventHandler);
export const addEhrEventHttp = makeHttpHandler(addEhrEventHandler);
