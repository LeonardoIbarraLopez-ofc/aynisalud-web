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
exports.getPatientPortalOverviewHttp = exports.getPatientPortalOverview = void 0;
const functions = __importStar(require("firebase-functions"));
const utils_1 = require("./utils");
const httpHelpers_1 = require("./httpHelpers");
function ensurePatientRole(role) {
    if (!role) {
        throw new functions.https.HttpsError('permission-denied', 'Autenticación requerida.');
    }
    const allowed = ['patient', 'admin', 'receptionist'];
    if (!allowed.includes(role)) {
        throw new functions.https.HttpsError('permission-denied', 'No autorizado para ver el portal del paciente.');
    }
}
function normalizePatientProfile(raw) {
    const data = raw.data();
    return {
        id: raw.id,
        firstName: String(data?.firstName || ''),
        lastName: String(data?.lastName || ''),
        dob: String(data?.dob || ''),
        gender: ['male', 'female', 'other'].includes(data?.gender) ? data.gender : 'other',
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
function normalizeAppointmentSummary(raw) {
    const data = raw.data();
    const startIso = (0, utils_1.toIsoString)(data?.startTime) || new Date().toISOString();
    const endIso = (0, utils_1.toIsoString)(data?.endTime) || startIso;
    const typeSnapshot = data?.typeSnapshot || data?.type || {};
    const doctorSnapshot = data?.doctorSnapshot || data?.doctor || {};
    const type = {
        id: String(typeSnapshot?.id || data?.typeId || ''),
        name: String(typeSnapshot?.name || ''),
        durationMinutes: Number.isFinite(typeSnapshot?.durationMinutes) ? Number(typeSnapshot.durationMinutes) : 30,
        price: Number.isFinite(typeSnapshot?.price) ? Number(typeSnapshot.price) : 0,
        description: typeSnapshot?.description || '',
    };
    const doctor = {
        id: String(doctorSnapshot?.id || data?.doctorId || ''),
        name: String(doctorSnapshot?.name || ''),
        email: doctorSnapshot?.email || undefined,
        role: doctorSnapshot?.role || undefined,
        phone: doctorSnapshot?.phone || undefined,
        avatarUrl: doctorSnapshot?.avatarUrl || undefined,
    };
    const status = [
        'pending_confirmation',
        'confirmed',
        'checked_in',
        'in_progress',
        'attended_pending_payment',
        'completed',
        'cancelled',
        'no_show',
    ].includes(data?.status)
        ? data.status
        : 'confirmed';
    return {
        id: raw.id,
        startTime: startIso,
        endTime: endIso,
        status,
        notes: data?.notes || undefined,
        type,
        doctor,
        associatedInvoiceId: data?.associatedInvoiceId || undefined,
    };
}
function normalizeInvoiceSummary(raw) {
    const data = raw.data();
    return {
        id: raw.id,
        patientId: String(data?.patientId || ''),
        appointmentId: data?.appointmentId ? String(data.appointmentId) : undefined,
        date: (0, utils_1.toIsoString)(data?.date) || new Date().toISOString(),
        dueDate: (0, utils_1.toIsoString)(data?.dueDate) || new Date().toISOString(),
        status: ['draft', 'sent', 'paid', 'overdue'].includes(data?.status)
            ? data.status
            : 'draft',
        subtotal: Number.isFinite(data?.subtotal) ? Number(data.subtotal) : 0,
        tax: Number.isFinite(data?.tax) ? Number(data.tax) : 0,
        total: Number.isFinite(data?.total) ? Number(data.total) : 0,
        paymentDetails: Array.isArray(data?.paymentDetails)
            ? data.paymentDetails.map((payment) => ({
                method: String(payment?.method || 'Efectivo'),
                amount: Number(payment?.amount) || 0,
                transactionDate: (0, utils_1.toIsoString)(payment?.transactionDate) || new Date().toISOString(),
            }))
            : [],
        lastPaymentAt: (0, utils_1.toIsoString)(data?.lastPaymentAt) || null,
    };
}
const getPatientPortalOverviewHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    ensurePatientRole(token?.role);
    let patientDoc = null;
    const requestedPatientId = data?.patientId ? String(data.patientId) : undefined;
    if (requestedPatientId && token?.role !== 'patient') {
        const snap = await utils_1.db.doc(`patients/${requestedPatientId}`).get();
        if (snap.exists) {
            patientDoc = snap;
        }
    }
    if (!patientDoc) {
        const snap = await utils_1.db.collection('patients').where('authUid', '==', uid).limit(1).get();
        if (snap.empty) {
            throw new functions.https.HttpsError('not-found', 'No se encontró un perfil de paciente.');
        }
        patientDoc = snap.docs[0];
    }
    const patient = normalizePatientProfile(patientDoc);
    const appointmentsSnap = await utils_1.db
        .collection('appointments')
        .where('patientId', '==', patient.id)
        .orderBy('startTime', 'asc')
        .limit(25)
        .get();
    const now = Date.now();
    const upcomingAppointments = appointmentsSnap.docs
        .map(normalizeAppointmentSummary)
        .filter(apt => new Date(apt.endTime).getTime() >= now)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 5);
    const invoicesSnap = await utils_1.db
        .collection('invoices')
        .where('patientId', '==', patient.id)
        .limit(25)
        .get();
    const invoices = invoicesSnap.docs.map(normalizeInvoiceSummary);
    const pendingInvoices = invoices
        .filter(inv => inv.status !== 'paid')
        .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
        .slice(0, 5);
    const recentInvoices = invoices
        .sort((a, b) => {
        const aTime = a.lastPaymentAt ? new Date(a.lastPaymentAt).getTime() : new Date(a.date).getTime();
        const bTime = b.lastPaymentAt ? new Date(b.lastPaymentAt).getTime() : new Date(b.date).getTime();
        return bTime - aTime;
    })
        .slice(0, 5);
    return {
        patient,
        upcomingAppointments,
        pendingInvoices,
        recentInvoices,
    };
};
exports.getPatientPortalOverview = functions.https.onCall(getPatientPortalOverviewHandler);
exports.getPatientPortalOverviewHttp = (0, httpHelpers_1.makeHttpHandler)(getPatientPortalOverviewHandler);
