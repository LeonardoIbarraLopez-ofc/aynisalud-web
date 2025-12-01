import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth, db, auditLog, getServerTimestamp, sanitizeForFirestore, toIsoString } from './utils';
import { makeHttpHandler } from './httpHelpers';

type UserRole = 'admin' | 'doctor' | 'specialist' | 'receptionist' | 'patient';

type AppointmentStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'attended_pending_payment'
  | 'completed'
  | 'cancelled'
  | 'no_show';

interface ContactInfo {
  email: string;
  phone: string;
  address: string;
}

interface InsuranceInfo {
  providerName: string;
  policyNumber: string;
  coverageDetails: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  idNumber: string;
  contactInfo: ContactInfo;
  insuranceInfo: InsuranceInfo[];
  allergies: string[];
  chronicConditions: string[];
  avatarUrl?: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  isActive: boolean;
  clinicId?: string;
}

interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string;
}

interface Appointment {
  id: string;
  patient: Patient;
  doctor: UserProfile;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  type: AppointmentType;
  checkinTime?: string;
  notes?: string;
  associatedInvoiceId?: string;
}

interface HydrationContext {
  patients: Map<string, Patient>;
  doctors: Map<string, UserProfile>;
  types: Map<string, AppointmentType>;
}

const VALID_AGENDA_ROLES: UserRole[] = ['admin', 'doctor', 'specialist', 'receptionist'];

const DEFAULT_APPOINTMENT_TYPES: Array<Omit<AppointmentType, 'id'> & { id: string }> = [
  { id: 'consulta-general', name: 'Consulta General', durationMinutes: 30, price: 150, description: 'Chequeo de rutina.' },
  { id: 'consulta-seguimiento', name: 'Consulta de Seguimiento', durationMinutes: 20, price: 100, description: 'Revisión de tratamiento.' },
  { id: 'consulta-cardiologia', name: 'Cardiología', durationMinutes: 45, price: 300, description: 'Consulta con especialista.' },
];

function ensureAgendaAccess(role: UserRole | undefined) {
  if (!role || !VALID_AGENDA_ROLES.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'No tiene permisos para gestionar la agenda.');
  }
}

function ensureReceptionAccess(role: UserRole | undefined) {
  if (!role || !(role === 'admin' || role === 'receptionist')) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso de recepción requerido.');
  }
}

function normalizePatient(data: any, id: string): Patient {
  return {
    id,
    firstName: String(data?.firstName || ''),
    lastName: String(data?.lastName || ''),
    dob: String(data?.dob || ''),
    gender: (data?.gender === 'male' || data?.gender === 'female' || data?.gender === 'other') ? data.gender : 'other',
    idNumber: String(data?.idNumber || ''),
    contactInfo: {
      email: String(data?.contactInfo?.email || ''),
      phone: String(data?.contactInfo?.phone || ''),
      address: String(data?.contactInfo?.address || ''),
    },
    insuranceInfo: Array.isArray(data?.insuranceInfo) ? data.insuranceInfo : [],
    allergies: Array.isArray(data?.allergies) ? data.allergies : [],
    chronicConditions: Array.isArray(data?.chronicConditions) ? data.chronicConditions : [],
    avatarUrl: data?.avatarUrl || undefined,
  };
}

function normalizeUser(data: any, id: string): UserProfile {
  const role: UserRole = ['admin', 'doctor', 'specialist', 'receptionist', 'patient'].includes(data?.role)
    ? data.role
    : 'doctor';
  return {
    id,
    name: String(data?.name || ''),
    email: String(data?.email || ''),
    role,
    avatarUrl: data?.avatarUrl || undefined,
    phone: data?.phone || undefined,
    isActive: data?.isActive !== undefined ? !!data.isActive : true,
    clinicId: data?.clinicId || undefined,
  };
}

function normalizeAppointmentType(data: any, id: string): AppointmentType {
  return {
    id,
    name: String(data?.name || ''),
    durationMinutes: Number.isFinite(data?.durationMinutes) ? Number(data.durationMinutes) : 30,
    price: Number.isFinite(data?.price) ? Number(data.price) : 0,
    description: String(data?.description || ''),
  };
}

function createHydrationContext(): HydrationContext {
  return {
    patients: new Map<string, Patient>(),
    doctors: new Map<string, UserProfile>(),
    types: new Map<string, AppointmentType>(),
  };
}

async function resolvePatient(patientId: string, snapshot: any | undefined, ctx: HydrationContext): Promise<Patient> {
  if (ctx.patients.has(patientId)) {
    return ctx.patients.get(patientId)!;
  }

  let patient: Patient | undefined;
  if (snapshot) {
    patient = normalizePatient(snapshot, snapshot.id || patientId);
  }

  if (!patient) {
    const snap = await db.doc(`patients/${patientId}`).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', `Paciente ${patientId} no encontrado.`);
    }
    patient = normalizePatient({ ...snap.data(), id: patientId }, patientId);
  }

  ctx.patients.set(patientId, patient);
  return patient;
}

async function resolveDoctor(doctorId: string, snapshot: any | undefined, ctx: HydrationContext): Promise<UserProfile> {
  if (ctx.doctors.has(doctorId)) {
    return ctx.doctors.get(doctorId)!;
  }

  let doctor: UserProfile | undefined;
  if (snapshot) {
    doctor = normalizeUser(snapshot, snapshot.id || doctorId);
  }

  if (!doctor) {
    const snap = await db.doc(`users/${doctorId}`).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', `Profesional ${doctorId} no encontrado.`);
    }
    doctor = normalizeUser({ ...snap.data(), id: doctorId }, doctorId);
  }

  ctx.doctors.set(doctorId, doctor);
  return doctor;
}

async function resolveAppointmentType(typeId: string, snapshot: any | undefined, ctx: HydrationContext): Promise<AppointmentType> {
  if (ctx.types.has(typeId)) {
    return ctx.types.get(typeId)!;
  }

  let type: AppointmentType | undefined;
  if (snapshot) {
    type = normalizeAppointmentType(snapshot, snapshot.id || typeId);
  }

  if (!type) {
    const snap = await db.doc(`appointmentTypes/${typeId}`).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', `Tipo de cita ${typeId} no encontrado.`);
    }
    type = normalizeAppointmentType({ ...snap.data(), id: typeId }, typeId);
  }

  ctx.types.set(typeId, type);
  return type;
}

async function createDraftInvoiceForAppointment(options: {
  appointmentId: string;
  patient: Patient;
  doctor: UserProfile;
  type: AppointmentType;
  startIso: string;
  endIso: string;
  clinicId: string | null;
}): Promise<string> {
  const invoiceRef = db.collection('invoices').doc();
  const now = getServerTimestamp();
  const payload = sanitizeForFirestore({
    patientId: options.patient.id,
    appointmentId: options.appointmentId,
    clinicId: options.clinicId,
    date: options.startIso,
    dueDate: options.endIso,
    status: 'draft',
    items: [
      {
        description: options.type.name || 'Servicio médico',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ],
    subtotal: 0,
    tax: 0,
    total: 0,
    paymentDetails: [],
    lastPaymentAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await invoiceRef.set(payload);

  await db.doc(`appointments/${options.appointmentId}`).set(
    sanitizeForFirestore({
      associatedInvoiceId: invoiceRef.id,
      updatedAt: getServerTimestamp(),
    }),
    { merge: true },
  );

  console.log('[createDraftInvoiceForAppointment] created', invoiceRef.id, 'for appointment', options.appointmentId);
  return invoiceRef.id;
}

async function hydrateAppointment(
  doc: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  ctx: HydrationContext,
  ensureInvoice: boolean = false,
): Promise<Appointment> {
  const data = doc.data() as any;
  const patientId: string = data?.patientId || data?.patient?.id;
  const doctorId: string = data?.doctorId || data?.doctor?.id;
  const typeId: string = data?.typeId || data?.type?.id;

  if (!patientId || !doctorId || !typeId) {
    throw new functions.https.HttpsError('internal', `Documento de cita ${doc.id} incompleto.`);
  }

  const [patient, doctor, type] = await Promise.all([
    resolvePatient(patientId, data?.patientSnapshot || data?.patient, ctx),
    resolveDoctor(doctorId, data?.doctorSnapshot || data?.doctor, ctx),
    resolveAppointmentType(typeId, data?.typeSnapshot || data?.type, ctx),
  ]);

  const startIso = toIsoString(data?.startTime) || new Date().toISOString();
  const endIso = toIsoString(data?.endTime) || new Date(new Date(startIso).getTime() + type.durationMinutes * 60000).toISOString();

  const status: AppointmentStatus = (
    [
      'pending_confirmation',
      'confirmed',
      'checked_in',
      'in_progress',
      'attended_pending_payment',
      'completed',
      'cancelled',
      'no_show',
    ] as AppointmentStatus[]
  ).includes(data?.status)
    ? data.status
    : 'confirmed';

  const checkinIso = toIsoString(data?.checkinTime);
  let associatedInvoiceId: string | undefined = data?.associatedInvoiceId || undefined;

  if (!associatedInvoiceId && ensureInvoice && status === 'attended_pending_payment') {
    try {
      associatedInvoiceId = await createDraftInvoiceForAppointment({
        appointmentId: doc.id,
        patient,
        doctor,
        type,
        startIso: startIso,
        endIso: endIso,
        clinicId: data?.clinicId || doctor.clinicId || null,
      });
    } catch (err) {
      console.error('[hydrateAppointment] failed to create draft invoice', doc.id, err);
    }
  }

  return {
    id: doc.id,
    patient,
    doctor,
    startTime: startIso,
    endTime: endIso,
    status,
    type,
    checkinTime: checkinIso,
    notes: data?.notes || undefined,
    associatedInvoiceId,
  };
}

function calculateEndTime(start: Date, type: AppointmentType): Date {
  const minutes = Number.isFinite(type.durationMinutes) ? type.durationMinutes : 30;
  return new Date(start.getTime() + minutes * 60000);
}

const listAgendaAppointmentsHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensureAgendaAccess(token?.role as UserRole | undefined);

  const targetDateIso = data?.date || new Date().toISOString();
  const targetDate = new Date(targetDateIso);
  if (Number.isNaN(targetDate.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'Fecha inválida.');
  }

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const ctxHydration = createHydrationContext();

  const querySnap = await db
    .collection('appointments')
    .where('startTime', '>=', startOfDay)
    .where('startTime', '<', endOfDay)
    .orderBy('startTime', 'asc')
    .get();

  const appointments: Appointment[] = [];
  for (const doc of querySnap.docs) {
    const appointment = await hydrateAppointment(doc, ctxHydration, true);
    appointments.push(appointment);
  }

  return { appointments };
};
export const listAgendaAppointments = functions.https.onCall(listAgendaAppointmentsHandler);
export const listAgendaAppointmentsHttp = makeHttpHandler(listAgendaAppointmentsHandler);

const getAppointmentsForPatientHandler = async (data: any, context: any) => {
  const { token, uid } = await requireAuth(context, data);
  const patientId: string = data?.patientId;
  if (!patientId) {
    throw new functions.https.HttpsError('invalid-argument', 'patientId requerido.');
  }

  const role = token?.role as UserRole | undefined;
  if (role === 'patient') {
    const patientSnap = await db.doc(`patients/${patientId}`).get();
    if (!patientSnap.exists || patientSnap.data()?.authUid !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'No autorizado para ver estas citas.');
    }
  } else {
    ensureAgendaAccess(role);
  }

  const ctxHydration = createHydrationContext();
  const querySnap = await db.collection('appointments').where('patientId', '==', patientId).get();

  const appointments: Appointment[] = [];
  for (const doc of querySnap.docs) {
    const appointment = await hydrateAppointment(doc, ctxHydration, true);
    appointments.push(appointment);
  }

  appointments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return { appointments };
};
export const getAppointmentsForPatient = functions.https.onCall(getAppointmentsForPatientHandler);
export const getAppointmentsForPatientHttp = makeHttpHandler(getAppointmentsForPatientHandler);

const getAppointmentByIdHandler = async (data: any, context: any) => {
  const { token, uid } = await requireAuth(context, data);
  const appointmentId: string = data?.appointmentId;
  if (!appointmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'appointmentId requerido.');
  }

  const doc = await db.doc(`appointments/${appointmentId}`).get();
  if (!doc.exists) {
    throw new functions.https.HttpsError('not-found', 'Cita no encontrada.');
  }

  const dataDoc = doc.data() as any;
  const role = token?.role as UserRole | undefined;

  if (role === 'patient') {
    if (!dataDoc?.patientId) {
      throw new functions.https.HttpsError('permission-denied', 'No autorizado.');
    }
    const patientSnap = await db.doc(`patients/${dataDoc.patientId}`).get();
    if (!patientSnap.exists || patientSnap.data()?.authUid !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'No autorizado.');
    }
  } else {
    ensureAgendaAccess(role);
  }

  const appointment = await hydrateAppointment(doc, createHydrationContext(), true);
  return { appointment };
};
export const getAppointmentById = functions.https.onCall(getAppointmentByIdHandler);
export const getAppointmentByIdHttp = makeHttpHandler(getAppointmentByIdHandler);

const createAppointmentHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  ensureReceptionAccess(token?.role as UserRole | undefined);

  console.log('[createAppointment] raw payload', JSON.stringify(data));
  const patientId: string = data?.patientId;
  const doctorId: string = data?.doctorId;
  const typeId: string = data?.typeId;
  const startTimeIso: string = data?.startTime;
  const notes: string | undefined = data?.notes ? String(data.notes) : undefined;

  if (!patientId || !doctorId || !typeId || !startTimeIso) {
    console.warn('[createAppointment] missing required fields', {
      hasPatientId: !!patientId,
      hasDoctorId: !!doctorId,
      hasTypeId: !!typeId,
      hasStartTime: !!startTimeIso,
    });
    throw new functions.https.HttpsError('invalid-argument', 'Faltan datos obligatorios.');
  }

  const startTime = new Date(startTimeIso);
  if (Number.isNaN(startTime.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'Fecha/hora inválida.');
  }

  const ctxHydration = createHydrationContext();
  const [patient, doctor, type] = await Promise.all([
    resolvePatient(patientId, undefined, ctxHydration),
    resolveDoctor(doctorId, undefined, ctxHydration),
    resolveAppointmentType(typeId, undefined, ctxHydration),
  ]);

  const endTime = calculateEndTime(startTime, type);
  console.log('[createAppointment] computed times', {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMinutes: type.durationMinutes,
  });

  const patientSnapshot = sanitizeForFirestore(patient);
  const doctorSnapshot = sanitizeForFirestore(doctor);
  const typeSnapshot = sanitizeForFirestore(type);
  console.log('[createAppointment] sanitized snapshots', {
    patientKeys: Object.keys(patientSnapshot || {}),
    doctorKeys: Object.keys(doctorSnapshot || {}),
    typeKeys: Object.keys(typeSnapshot || {}),
  });

  const docRef = db.collection('appointments').doc();
  const now = getServerTimestamp();

  const clinicId = token?.clinicId || doctor.clinicId || null;

  await docRef.set({
    patientId,
    doctorId,
    typeId,
    startTime,
    endTime,
    status: 'confirmed',
    notes: notes || null,
    clinicId,
    createdAt: now,
    updatedAt: now,
    createdBy: { uid, role: token?.role || null },
    patientSnapshot,
    doctorSnapshot,
    typeSnapshot,
  });

  console.log('[createAppointment] appointment stored', { id: docRef.id, patientId, doctorId, typeId });
  const invoiceId = await createDraftInvoiceForAppointment({
    appointmentId: docRef.id,
    patient,
    doctor,
    type,
    startIso: startTime.toISOString(),
    endIso: endTime.toISOString(),
    clinicId,
  });

  const appointment = await hydrateAppointment(await docRef.get(), ctxHydration);

  await auditLog(uid as string, 'create_appointment', 'appointments', docRef.id, {
    patientId,
    doctorId,
    typeId,
    startTime: startTimeIso,
    invoiceId,
  });

  return { appointment };
};
export const createAppointment = functions.https.onCall(createAppointmentHandler);
export const createAppointmentHttp = makeHttpHandler(createAppointmentHandler);

const updateAppointmentStatusHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  ensureAgendaAccess(token?.role as UserRole | undefined);

  const appointmentId: string = data?.appointmentId;
  const status: AppointmentStatus = data?.status;

  const allowedStatuses: AppointmentStatus[] = [
    'pending_confirmation',
    'confirmed',
    'checked_in',
    'in_progress',
    'attended_pending_payment',
    'completed',
    'cancelled',
    'no_show',
  ];

  if (!appointmentId || !allowedStatuses.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Datos inválidos para actualización de estado.');
  }

  const docRef = db.doc(`appointments/${appointmentId}`);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Cita no encontrada.');
  }

  const updates: Record<string, any> = {
    status,
    updatedAt: getServerTimestamp(),
  };

  if (status === 'checked_in') {
    updates.checkinTime = getServerTimestamp();
  }

  await docRef.set(updates, { merge: true });

  const appointment = await hydrateAppointment(await docRef.get(), createHydrationContext(), true);

  await auditLog(uid as string, 'update_appointment_status', 'appointments', appointmentId, {
    status,
  });

  return { appointment };
};
export const updateAppointmentStatus = functions.https.onCall(updateAppointmentStatusHandler);
export const updateAppointmentStatusHttp = makeHttpHandler(updateAppointmentStatusHandler);

const searchPatientsHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensureAgendaAccess(token?.role as UserRole | undefined);

  console.log('[searchPatients] raw payload', JSON.stringify(data));
  const query: string = String(data?.query || data?.body?.query || '').trim().toLowerCase();
  console.log('[searchPatients] normalized query', query);
  if (!query) {
    console.log('[searchPatients] empty query, returning []');
    return { patients: [] };
  }

  const snap = await db.collection('patients').limit(200).get();
  console.log('[searchPatients] fetched docs', snap.size);
  const patients: Patient[] = [];

  for (const doc of snap.docs) {
    const patient = normalizePatient({ ...doc.data(), id: doc.id }, doc.id);
    const haystack = [
      `${patient.firstName} ${patient.lastName}`,
      patient.idNumber,
      patient.contactInfo.email,
      patient.contactInfo.phone,
    ]
      .join(' ')
      .toLowerCase();

    if (haystack.includes(query)) {
      console.log('[searchPatients] matched patient', patient.id, haystack);
      patients.push(patient);
    }

    if (patients.length >= 20) break;
  }

  console.log('[searchPatients] returning matches', patients.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })));
  return { patients };
};
export const searchPatients = functions.https.onCall(searchPatientsHandler);
export const searchPatientsHttp = makeHttpHandler(searchPatientsHandler);

function buildSearchKeywords(values: Array<string | undefined>): string[] {
  const tokens = new Set<string>();
  values
    .map(v => (v || '').toLowerCase().trim())
    .filter(v => v.length > 0)
    .forEach(value => {
      tokens.add(value);
      value.split(/\s+/).forEach(part => tokens.add(part));
    });
  return Array.from(tokens).slice(0, 40);
}

const createQuickPatientHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  ensureReceptionAccess(token?.role as UserRole | undefined);

  const firstName = String(data?.firstName || '').trim();
  const lastName = String(data?.lastName || '').trim();
  const phone = String(data?.phone || '').trim();

  if (!firstName || !lastName) {
    throw new functions.https.HttpsError('invalid-argument', 'Nombre y apellidos son obligatorios.');
  }

  const patientDocRef = db.collection('patients').doc();
  const now = getServerTimestamp();

  const patientPayload = {
    firstName,
    lastName,
    dob: '',
    gender: 'other',
    idNumber: '',
    contactInfo: {
      email: '',
      phone,
      address: '',
    },
    insuranceInfo: [],
    allergies: [],
    chronicConditions: [],
    avatarUrl: '',
    clinicId: token?.clinicId || null,
    createdAt: now,
    updatedAt: now,
    createdBy: { uid, role: token?.role || null },
    searchKeywords: buildSearchKeywords([firstName, lastName, phone]),
  };

  await patientDocRef.set(patientPayload);

  await auditLog(uid as string, 'create_patient_quick', 'patients', patientDocRef.id, {
    firstName,
    lastName,
    phone,
  });

  const patient = normalizePatient({ ...patientPayload, id: patientDocRef.id }, patientDocRef.id);
  return { patient };
};
export const createQuickPatient = functions.https.onCall(createQuickPatientHandler);
export const createQuickPatientHttp = makeHttpHandler(createQuickPatientHandler);

const listDoctorsHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensureAgendaAccess(token?.role as UserRole | undefined);

  const snap = await db
    .collection('users')
    .where('role', 'in', ['doctor', 'specialist'])
    .limit(200)
    .get();

  const doctors = snap.docs.map(doc => normalizeUser({ ...doc.data(), id: doc.id }, doc.id));
  return { doctors };
};
export const listDoctors = functions.https.onCall(listDoctorsHandler);
export const listDoctorsHttp = makeHttpHandler(listDoctorsHandler);

const listAppointmentTypesHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensureAgendaAccess(token?.role as UserRole | undefined);

  const colRef = db.collection('appointmentTypes');
  const snap = await colRef.get();

  if (snap.empty) {
    const batch = db.batch();
    const now = getServerTimestamp();
    DEFAULT_APPOINTMENT_TYPES.forEach(type => {
      const ref = colRef.doc(type.id);
      batch.set(ref, {
        name: type.name,
        durationMinutes: type.durationMinutes,
        price: type.price,
        description: type.description,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
    });
    await batch.commit();
  }

  const refreshed = await colRef.get();

  const appointmentTypes = refreshed.docs.map(doc => normalizeAppointmentType({ ...doc.data(), id: doc.id }, doc.id));
  return { appointmentTypes };
};
export const listAppointmentTypes = functions.https.onCall(listAppointmentTypesHandler);
export const listAppointmentTypesHttp = makeHttpHandler(listAppointmentTypesHandler);

export const __testables = {
  searchPatientsHandler,
};
