import * as admin from 'firebase-admin';

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
const patientPortal = require('./patientPortal');
const patientScheduling = require('./patientScheduling');
const ehr = require('./ehr');
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
export const getPatientPortalOverview = patientPortal.getPatientPortalOverview;
export const getPatientPortalOverviewHttp = patientPortal.getPatientPortalOverviewHttp;
export const getPatientAvailability = patientScheduling.getPatientAvailability;
export const getPatientAvailabilityHttp = patientScheduling.getPatientAvailabilityHttp;
export const requestAppointment = patientScheduling.requestAppointment;
export const requestAppointmentHttp = patientScheduling.requestAppointmentHttp;
export const listPatientAppointmentTypes = patientScheduling.listPatientAppointmentTypes;
export const listPatientAppointmentTypesHttp = patientScheduling.listPatientAppointmentTypesHttp;
export const listPatientDoctors = patientScheduling.listPatientDoctors;
export const listPatientDoctorsHttp = patientScheduling.listPatientDoctorsHttp;
export const getProviderSchedule = patientScheduling.getProviderSchedule;
export const getProviderScheduleHttp = patientScheduling.getProviderScheduleHttp;
export const saveProviderSchedule = patientScheduling.saveProviderSchedule;
export const saveProviderScheduleHttp = patientScheduling.saveProviderScheduleHttp;
export const getPatientEhr = ehr.getPatientEhr;
export const getPatientEhrHttp = ehr.getPatientEhrHttp;
export const addEhrEvent = ehr.addEhrEvent;
export const addEhrEventHttp = ehr.addEhrEventHttp;
