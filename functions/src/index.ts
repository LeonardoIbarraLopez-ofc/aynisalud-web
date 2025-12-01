import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, db, loadPatient, isAdmin, isClinician, auditLog } from './utils';

// Initialize the Admin SDK before loading modules that may call admin APIs
// during top-level initialization. We use a runtime require for `users` so
// that admin.initializeApp() runs first and prevents "default app does not exist" errors.
if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp();
}
// Load side-effect modules after initialization and re-export their callables
// so the Functions emulator detects them as top-level exports.
const users = require('./users');
const admin2fa = require('./admin2fa');
const passwordReset = require('./passwordReset');
const agenda = require('./agenda');
const billing = require('./billing');
// Re-export user callables from the main entry to ensure firebase-tools
// discovers them when the codebase `main` points to this file.
export const createUserAdmin = users.createUserAdmin;
export const updateProfile = users.updateProfile;
export const linkPatient = users.linkPatient;
export const setCustomClaims = users.setCustomClaims;
export const getMyProfile = users.getMyProfile;
export const getMyProfileHttp = users.getMyProfileHttp;
export const requestAdmin2FA = admin2fa.requestAdmin2FA;
export const verifyAdmin2FA = admin2fa.verifyAdmin2FA;
export const requestAdmin2FAHttp = admin2fa.requestAdmin2FAHttp;
export const verifyAdmin2FAHttp = admin2fa.verifyAdmin2FAHttp;
export const requestPasswordResetHttp = passwordReset.requestPasswordResetHttp;
export const verifyPasswordResetHttp = passwordReset.verifyPasswordResetHttp;
export const listAgendaAppointments = agenda.listAgendaAppointments;
export const getAppointmentsForPatient = agenda.getAppointmentsForPatient;
export const getAppointmentById = agenda.getAppointmentById;
export const createAppointment = agenda.createAppointment;
export const updateAppointmentStatus = agenda.updateAppointmentStatus;
export const searchPatients = agenda.searchPatients;
export const createQuickPatient = agenda.createQuickPatient;
export const listDoctors = agenda.listDoctors;
export const listAppointmentTypes = agenda.listAppointmentTypes;
export const listAgendaAppointmentsHttp = agenda.listAgendaAppointmentsHttp;
export const getAppointmentsForPatientHttp = agenda.getAppointmentsForPatientHttp;
export const getAppointmentByIdHttp = agenda.getAppointmentByIdHttp;
export const createAppointmentHttp = agenda.createAppointmentHttp;
export const updateAppointmentStatusHttp = agenda.updateAppointmentStatusHttp;
export const searchPatientsHttp = agenda.searchPatientsHttp;
export const createQuickPatientHttp = agenda.createQuickPatientHttp;
export const listDoctorsHttp = agenda.listDoctorsHttp;
export const listAppointmentTypesHttp = agenda.listAppointmentTypesHttp;
export const listPaidInvoicesForToday = billing.listPaidInvoicesForToday;
export const getInvoiceById = billing.getInvoiceById;
export const updateInvoice = billing.updateInvoice;
export const listPaidInvoicesForTodayHttp = billing.listPaidInvoicesForTodayHttp;
export const getInvoiceByIdHttp = billing.getInvoiceByIdHttp;
export const updateInvoiceHttp = billing.updateInvoiceHttp;

// Callable: getPatientEhr
export const getPatientEhr = functions.https.onCall(async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  const { patientId } = data || {};
  let { limit = 100, since } = data || {};
  limit = Math.min(Number(limit) || 100, 500);
  if (!patientId) throw new functions.https.HttpsError('invalid-argument', 'patientId required');

  // Authorization policy (server-side): patient himself OR clinician assigned OR admin
  const patientDoc = await db.doc(`patients/${patientId}`).get();
  if (!patientDoc.exists) throw new functions.https.HttpsError('not-found', 'patient not found');
  const patient = patientDoc.data() as any;

  const callerUid = uid as string;

  const allowed = (patient.authUid && patient.authUid === callerUid)
    || (Array.isArray(patient.authorizedClinicians) && patient.authorizedClinicians.includes(callerUid))
    || isAdmin(token);

  if (!allowed) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to read EHR for this patient');
  }

  // Audit
  await auditLog(callerUid, 'read_ehr', 'patients', patientId, { limit, since });

  // Query timeline subcollection (secure server-side)
  let q: admin.firestore.Query = db.collection(`patients/${patientId}/timeline`).orderBy('date', 'desc').limit(limit);
  if (since) q = q.where('date', '>=', new Date(since));

  const snap: admin.firestore.QuerySnapshot = await q.get();
  const events = snap.docs.map((d: admin.firestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }));
  return { patientId, events };
});

// Callable: addEhrEvent
export const addEhrEvent = functions.https.onCall(async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  const { patientId, event } = data || {};
  if (!patientId || !event || !event.type) throw new functions.https.HttpsError('invalid-argument', 'patientId and event.type required');

  const callerUid = uid as string;
  const patientSnap = await db.doc(`patients/${patientId}`).get();
  if (!patientSnap.exists) throw new functions.https.HttpsError('not-found', 'patient not found');
  const patient = patientSnap.data() as any;

  // Only clinicians or admin or the patient (for personal notes) can add events
  const allowedToWrite = isClinician(token) || isAdmin(token) || (patient.authUid && patient.authUid === callerUid);
  if (!allowedToWrite) throw new functions.https.HttpsError('permission-denied', 'Not authorized to add EHR event');

  // Create a new event id
  const eventId = uuidv4();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const eventDate = event.date ? new Date(event.date) : admin.firestore.FieldValue.serverTimestamp();

  const eventDoc = {
    ...event,
    actor: { uid: callerUid, role: token?.role || null },
    createdAt: now,
    updatedAt: now,
    date: eventDate,
  };

  // Write to patient timeline and create searchable shadow
  const timelineRef = db.doc(`patients/${patientId}/timeline/${eventId}`);
  const searchableRef = db.collection('ehrEvents_searchable').doc(eventId);

  // Use a batch for atomic-ish write (both will either be written or not) -- Firestore batch is atomic per 500 writes
  const batch = db.batch();
  batch.set(timelineRef, eventDoc);

  // Prepare searchable shadow
  const searchableDoc = {
    eventId,
    patientId,
    clinicId: patient.clinicId || null,
    // if eventDate is a Date use it, otherwise use serverTimestamp
    date: eventDate instanceof Date ? eventDate : admin.firestore.FieldValue.serverTimestamp(),
    type: event.type,
    code: event.code || null,
    actorDoctorId: event.actorDoctorId || null,
    createdAt: now,
  };
  batch.set(searchableRef, searchableDoc);

  await batch.commit();

  // Audit
  await auditLog(callerUid, 'create_ehr_event', 'patients', patientId, { eventId, type: event.type });

  return { success: true, eventId };
});
