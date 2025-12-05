"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveProviderScheduleHttp = exports.saveProviderSchedule = exports.getProviderScheduleHttp = exports.getProviderSchedule = exports.listPatientDoctorsHttp = exports.listPatientDoctors = exports.listPatientAppointmentTypesHttp = exports.listPatientAppointmentTypes = exports.requestAppointmentHttp = exports.requestAppointment = exports.getPatientAvailabilityHttp = exports.getPatientAvailability = exports.getPatientPortalOverviewHttp = exports.getPatientPortalOverview = exports.updateInvoiceHttp = exports.getInvoiceByIdHttp = exports.listPaidInvoicesForTodayHttp = exports.updateInvoice = exports.getInvoiceById = exports.listPaidInvoicesForToday = exports.listAppointmentTypesHttp = exports.listDoctorsHttp = exports.createQuickPatientHttp = exports.searchPatientsHttp = exports.updateAppointmentStatusHttp = exports.createAppointmentHttp = exports.getAppointmentByIdHttp = exports.getAppointmentsForPatientHttp = exports.listAgendaAppointmentsHttp = exports.listAppointmentTypes = exports.listDoctors = exports.createQuickPatient = exports.searchPatients = exports.updateAppointmentStatus = exports.createAppointment = exports.getAppointmentById = exports.getAppointmentsForPatient = exports.listAgendaAppointments = exports.verifyPasswordResetHttp = exports.requestPasswordResetHttp = exports.verifyAdmin2FAHttp = exports.requestAdmin2FAHttp = exports.verifyAdmin2FA = exports.requestAdmin2FA = exports.getMyProfileHttp = exports.getMyProfile = exports.setCustomClaims = exports.linkPatient = exports.updateProfile = exports.createUserAdmin = void 0;
exports.addEhrEventHttp = exports.addEhrEvent = exports.getPatientEhrHttp = exports.getPatientEhr = void 0;
const admin = __importStar(require("firebase-admin"));
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
exports.createUserAdmin = users.createUserAdmin;
exports.updateProfile = users.updateProfile;
exports.linkPatient = users.linkPatient;
exports.setCustomClaims = users.setCustomClaims;
exports.getMyProfile = users.getMyProfile;
exports.getMyProfileHttp = users.getMyProfileHttp;
exports.requestAdmin2FA = admin2fa.requestAdmin2FA;
exports.verifyAdmin2FA = admin2fa.verifyAdmin2FA;
exports.requestAdmin2FAHttp = admin2fa.requestAdmin2FAHttp;
exports.verifyAdmin2FAHttp = admin2fa.verifyAdmin2FAHttp;
exports.requestPasswordResetHttp = passwordReset.requestPasswordResetHttp;
exports.verifyPasswordResetHttp = passwordReset.verifyPasswordResetHttp;
exports.listAgendaAppointments = agenda.listAgendaAppointments;
exports.getAppointmentsForPatient = agenda.getAppointmentsForPatient;
exports.getAppointmentById = agenda.getAppointmentById;
exports.createAppointment = agenda.createAppointment;
exports.updateAppointmentStatus = agenda.updateAppointmentStatus;
exports.searchPatients = agenda.searchPatients;
exports.createQuickPatient = agenda.createQuickPatient;
exports.listDoctors = agenda.listDoctors;
exports.listAppointmentTypes = agenda.listAppointmentTypes;
exports.listAgendaAppointmentsHttp = agenda.listAgendaAppointmentsHttp;
exports.getAppointmentsForPatientHttp = agenda.getAppointmentsForPatientHttp;
exports.getAppointmentByIdHttp = agenda.getAppointmentByIdHttp;
exports.createAppointmentHttp = agenda.createAppointmentHttp;
exports.updateAppointmentStatusHttp = agenda.updateAppointmentStatusHttp;
exports.searchPatientsHttp = agenda.searchPatientsHttp;
exports.createQuickPatientHttp = agenda.createQuickPatientHttp;
exports.listDoctorsHttp = agenda.listDoctorsHttp;
exports.listAppointmentTypesHttp = agenda.listAppointmentTypesHttp;
exports.listPaidInvoicesForToday = billing.listPaidInvoicesForToday;
exports.getInvoiceById = billing.getInvoiceById;
exports.updateInvoice = billing.updateInvoice;
exports.listPaidInvoicesForTodayHttp = billing.listPaidInvoicesForTodayHttp;
exports.getInvoiceByIdHttp = billing.getInvoiceByIdHttp;
exports.updateInvoiceHttp = billing.updateInvoiceHttp;
exports.getPatientPortalOverview = patientPortal.getPatientPortalOverview;
exports.getPatientPortalOverviewHttp = patientPortal.getPatientPortalOverviewHttp;
exports.getPatientAvailability = patientScheduling.getPatientAvailability;
exports.getPatientAvailabilityHttp = patientScheduling.getPatientAvailabilityHttp;
exports.requestAppointment = patientScheduling.requestAppointment;
exports.requestAppointmentHttp = patientScheduling.requestAppointmentHttp;
exports.listPatientAppointmentTypes = patientScheduling.listPatientAppointmentTypes;
exports.listPatientAppointmentTypesHttp = patientScheduling.listPatientAppointmentTypesHttp;
exports.listPatientDoctors = patientScheduling.listPatientDoctors;
exports.listPatientDoctorsHttp = patientScheduling.listPatientDoctorsHttp;
exports.getProviderSchedule = patientScheduling.getProviderSchedule;
exports.getProviderScheduleHttp = patientScheduling.getProviderScheduleHttp;
exports.saveProviderSchedule = patientScheduling.saveProviderSchedule;
exports.saveProviderScheduleHttp = patientScheduling.saveProviderScheduleHttp;
exports.getPatientEhr = ehr.getPatientEhr;
exports.getPatientEhrHttp = ehr.getPatientEhrHttp;
exports.addEhrEvent = ehr.addEhrEvent;
exports.addEhrEventHttp = ehr.addEhrEventHttp;
