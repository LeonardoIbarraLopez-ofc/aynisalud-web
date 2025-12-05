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
exports.__testables = exports.listAppointmentTypesHttp = exports.listAppointmentTypes = exports.listDoctorsHttp = exports.listDoctors = exports.createQuickPatientHttp = exports.createQuickPatient = exports.searchPatientsHttp = exports.searchPatients = exports.updateAppointmentStatusHttp = exports.updateAppointmentStatus = exports.createAppointmentHttp = exports.createAppointment = exports.getAppointmentByIdHttp = exports.getAppointmentById = exports.getAppointmentsForPatientHttp = exports.getAppointmentsForPatient = exports.listAgendaAppointmentsHttp = exports.listAgendaAppointments = void 0;
const functions = __importStar(require("firebase-functions"));
const utils_1 = require("./utils");
const httpHelpers_1 = require("./httpHelpers");
const VALID_AGENDA_ROLES = ['admin', 'doctor', 'specialist', 'receptionist'];
const DEFAULT_APPOINTMENT_TYPES = [
    { id: 'consulta-general', name: 'Consulta General', durationMinutes: 30, price: 150, description: 'Chequeo de rutina.' },
    { id: 'consulta-seguimiento', name: 'Consulta de Seguimiento', durationMinutes: 20, price: 100, description: 'Revisión de tratamiento.' },
    { id: 'consulta-cardiologia', name: 'Cardiología', durationMinutes: 45, price: 300, description: 'Consulta con especialista.' },
];
function ensureAgendaAccess(role) {
    if (!role || !VALID_AGENDA_ROLES.includes(role)) {
        throw new functions.https.HttpsError('permission-denied', 'No tiene permisos para gestionar la agenda.');
    }
}
function ensureReceptionAccess(role) {
    if (!role || !(role === 'admin' || role === 'receptionist')) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso de recepción requerido.');
    }
}
function normalizePatient(data, id) {
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
function normalizeUser(data, id) {
    const role = ['admin', 'doctor', 'specialist', 'receptionist', 'patient'].includes(data?.role)
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
function normalizeAppointmentType(data, id) {
    return {
        id,
        name: String(data?.name || ''),
        durationMinutes: Number.isFinite(data?.durationMinutes) ? Number(data.durationMinutes) : 30,
        price: Number.isFinite(data?.price) ? Number(data.price) : 0,
        description: String(data?.description || ''),
    };
}
function createHydrationContext() {
    return {
        patients: new Map(),
        doctors: new Map(),
        types: new Map(),
    };
}
async function resolvePatient(patientId, snapshot, ctx) {
    if (ctx.patients.has(patientId)) {
        return ctx.patients.get(patientId);
    }
    let patient;
    if (snapshot) {
        patient = normalizePatient(snapshot, snapshot.id || patientId);
    }
    if (!patient) {
        const snap = await utils_1.db.doc(`patients/${patientId}`).get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', `Paciente ${patientId} no encontrado.`);
        }
        patient = normalizePatient({ ...snap.data(), id: patientId }, patientId);
    }
    ctx.patients.set(patientId, patient);
    return patient;
}
async function resolveDoctor(doctorId, snapshot, ctx) {
    if (ctx.doctors.has(doctorId)) {
        return ctx.doctors.get(doctorId);
    }
    let doctor;
    if (snapshot) {
        doctor = normalizeUser(snapshot, snapshot.id || doctorId);
    }
    if (!doctor) {
        const snap = await utils_1.db.doc(`users/${doctorId}`).get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', `Profesional ${doctorId} no encontrado.`);
        }
        doctor = normalizeUser({ ...snap.data(), id: doctorId }, doctorId);
    }
    ctx.doctors.set(doctorId, doctor);
    return doctor;
}
async function resolveAppointmentType(typeId, snapshot, ctx) {
    if (ctx.types.has(typeId)) {
        return ctx.types.get(typeId);
    }
    let type;
    if (snapshot) {
        type = normalizeAppointmentType(snapshot, snapshot.id || typeId);
    }
    if (!type) {
        const snap = await utils_1.db.doc(`appointmentTypes/${typeId}`).get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', `Tipo de cita ${typeId} no encontrado.`);
        }
        type = normalizeAppointmentType({ ...snap.data(), id: typeId }, typeId);
    }
    ctx.types.set(typeId, type);
    return type;
}
async function createDraftInvoiceForAppointment(options) {
    const invoiceRef = utils_1.db.collection('invoices').doc();
    const now = (0, utils_1.getServerTimestamp)();
    const payload = (0, utils_1.sanitizeForFirestore)({
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
    await utils_1.db.doc(`appointments/${options.appointmentId}`).set((0, utils_1.sanitizeForFirestore)({
        associatedInvoiceId: invoiceRef.id,
        updatedAt: (0, utils_1.getServerTimestamp)(),
    }), { merge: true });
    console.log('[createDraftInvoiceForAppointment] created', invoiceRef.id, 'for appointment', options.appointmentId);
    return invoiceRef.id;
}
async function hydrateAppointment(doc, ctx, ensureInvoice = false) {
    const data = doc.data();
    const patientId = data?.patientId || data?.patient?.id;
    const doctorId = data?.doctorId || data?.doctor?.id;
    const typeId = data?.typeId || data?.type?.id;
    if (!patientId || !doctorId || !typeId) {
        throw new functions.https.HttpsError('internal', `Documento de cita ${doc.id} incompleto.`);
    }
    const [patient, doctor, type] = await Promise.all([
        resolvePatient(patientId, data?.patientSnapshot || data?.patient, ctx),
        resolveDoctor(doctorId, data?.doctorSnapshot || data?.doctor, ctx),
        resolveAppointmentType(typeId, data?.typeSnapshot || data?.type, ctx),
    ]);
    const startIso = (0, utils_1.toIsoString)(data?.startTime) || new Date().toISOString();
    const endIso = (0, utils_1.toIsoString)(data?.endTime) || new Date(new Date(startIso).getTime() + type.durationMinutes * 60000).toISOString();
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
    const checkinIso = (0, utils_1.toIsoString)(data?.checkinTime);
    let associatedInvoiceId = data?.associatedInvoiceId || undefined;
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
        }
        catch (err) {
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
function calculateEndTime(start, type) {
    const minutes = Number.isFinite(type.durationMinutes) ? type.durationMinutes : 30;
    return new Date(start.getTime() + minutes * 60000);
}
const listAgendaAppointmentsHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensureAgendaAccess(token?.role);
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
    const querySnap = await utils_1.db
        .collection('appointments')
        .where('startTime', '>=', startOfDay)
        .where('startTime', '<', endOfDay)
        .orderBy('startTime', 'asc')
        .get();
    const appointments = [];
    for (const doc of querySnap.docs) {
        const appointment = await hydrateAppointment(doc, ctxHydration, true);
        appointments.push(appointment);
    }
    return { appointments };
};
exports.listAgendaAppointments = functions.https.onCall(listAgendaAppointmentsHandler);
exports.listAgendaAppointmentsHttp = (0, httpHelpers_1.makeHttpHandler)(listAgendaAppointmentsHandler);
const getAppointmentsForPatientHandler = async (data, context) => {
    const { token, uid } = await (0, utils_1.requireAuth)(context, data);
    const role = token?.role;
    let requestedPatientId = typeof data?.patientId === 'string' ? String(data.patientId).trim() : '';
    if (role === 'patient') {
        const patientQuery = await utils_1.db.collection('patients').where('authUid', '==', uid).limit(1).get();
        if (patientQuery.empty) {
            throw new functions.https.HttpsError('failed-precondition', 'Debe completar su perfil de paciente antes de continuar.');
        }
        const ownPatientId = patientQuery.docs[0].id;
        if (requestedPatientId && requestedPatientId !== ownPatientId) {
            throw new functions.https.HttpsError('permission-denied', 'No autorizado para ver estas citas.');
        }
        requestedPatientId = ownPatientId;
    }
    else {
        if (!requestedPatientId) {
            throw new functions.https.HttpsError('invalid-argument', 'patientId requerido.');
        }
        ensureAgendaAccess(role);
    }
    if (!requestedPatientId) {
        throw new functions.https.HttpsError('invalid-argument', 'patientId requerido.');
    }
    const ctxHydration = createHydrationContext();
    const querySnap = await utils_1.db.collection('appointments').where('patientId', '==', requestedPatientId).get();
    const appointments = [];
    for (const doc of querySnap.docs) {
        const appointment = await hydrateAppointment(doc, ctxHydration, true);
        appointments.push(appointment);
    }
    appointments.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return { appointments };
};
exports.getAppointmentsForPatient = functions.https.onCall(getAppointmentsForPatientHandler);
exports.getAppointmentsForPatientHttp = (0, httpHelpers_1.makeHttpHandler)(getAppointmentsForPatientHandler);
const getAppointmentByIdHandler = async (data, context) => {
    const { token, uid } = await (0, utils_1.requireAuth)(context, data);
    const appointmentId = data?.appointmentId;
    if (!appointmentId) {
        throw new functions.https.HttpsError('invalid-argument', 'appointmentId requerido.');
    }
    const doc = await utils_1.db.doc(`appointments/${appointmentId}`).get();
    if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Cita no encontrada.');
    }
    const dataDoc = doc.data();
    const role = token?.role;
    if (role === 'patient') {
        if (!dataDoc?.patientId) {
            throw new functions.https.HttpsError('permission-denied', 'No autorizado.');
        }
        const patientSnap = await utils_1.db.doc(`patients/${dataDoc.patientId}`).get();
        if (!patientSnap.exists || patientSnap.data()?.authUid !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'No autorizado.');
        }
    }
    else {
        ensureAgendaAccess(role);
    }
    const appointment = await hydrateAppointment(doc, createHydrationContext(), true);
    return { appointment };
};
exports.getAppointmentById = functions.https.onCall(getAppointmentByIdHandler);
exports.getAppointmentByIdHttp = (0, httpHelpers_1.makeHttpHandler)(getAppointmentByIdHandler);
const createAppointmentHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    ensureReceptionAccess(token?.role);
    console.log('[createAppointment] raw payload', JSON.stringify(data));
    const patientId = data?.patientId;
    const doctorId = data?.doctorId;
    const typeId = data?.typeId;
    const startTimeIso = data?.startTime;
    const notes = data?.notes ? String(data.notes) : undefined;
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
    const patientSnapshot = (0, utils_1.sanitizeForFirestore)(patient);
    const doctorSnapshot = (0, utils_1.sanitizeForFirestore)(doctor);
    const typeSnapshot = (0, utils_1.sanitizeForFirestore)(type);
    console.log('[createAppointment] sanitized snapshots', {
        patientKeys: Object.keys(patientSnapshot || {}),
        doctorKeys: Object.keys(doctorSnapshot || {}),
        typeKeys: Object.keys(typeSnapshot || {}),
    });
    const docRef = utils_1.db.collection('appointments').doc();
    const now = (0, utils_1.getServerTimestamp)();
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
    await (0, utils_1.auditLog)(uid, 'create_appointment', 'appointments', docRef.id, {
        patientId,
        doctorId,
        typeId,
        startTime: startTimeIso,
        invoiceId,
    });
    return { appointment };
};
exports.createAppointment = functions.https.onCall(createAppointmentHandler);
exports.createAppointmentHttp = (0, httpHelpers_1.makeHttpHandler)(createAppointmentHandler);
const updateAppointmentStatusHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    ensureAgendaAccess(token?.role);
    const appointmentId = data?.appointmentId;
    const status = data?.status;
    const allowedStatuses = [
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
    const docRef = utils_1.db.doc(`appointments/${appointmentId}`);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Cita no encontrada.');
    }
    const updates = {
        status,
        updatedAt: (0, utils_1.getServerTimestamp)(),
    };
    if (status === 'checked_in') {
        updates.checkinTime = (0, utils_1.getServerTimestamp)();
    }
    await docRef.set(updates, { merge: true });
    const appointment = await hydrateAppointment(await docRef.get(), createHydrationContext(), true);
    await (0, utils_1.auditLog)(uid, 'update_appointment_status', 'appointments', appointmentId, {
        status,
    });
    return { appointment };
};
exports.updateAppointmentStatus = functions.https.onCall(updateAppointmentStatusHandler);
exports.updateAppointmentStatusHttp = (0, httpHelpers_1.makeHttpHandler)(updateAppointmentStatusHandler);
const searchPatientsHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensureAgendaAccess(token?.role);
    console.log('[searchPatients] raw payload', JSON.stringify(data));
    const query = String(data?.query || data?.body?.query || '').trim().toLowerCase();
    console.log('[searchPatients] normalized query', query);
    if (!query) {
        console.log('[searchPatients] empty query, returning []');
        return { patients: [] };
    }
    const snap = await utils_1.db.collection('patients').limit(200).get();
    console.log('[searchPatients] fetched docs', snap.size);
    const patients = [];
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
        if (patients.length >= 20)
            break;
    }
    console.log('[searchPatients] returning matches', patients.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })));
    return { patients };
};
exports.searchPatients = functions.https.onCall(searchPatientsHandler);
exports.searchPatientsHttp = (0, httpHelpers_1.makeHttpHandler)(searchPatientsHandler);
function buildSearchKeywords(values) {
    const tokens = new Set();
    values
        .map(v => (v || '').toLowerCase().trim())
        .filter(v => v.length > 0)
        .forEach(value => {
        tokens.add(value);
        value.split(/\s+/).forEach(part => tokens.add(part));
    });
    return Array.from(tokens).slice(0, 40);
}
const createQuickPatientHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    ensureReceptionAccess(token?.role);
    const firstName = String(data?.firstName || '').trim();
    const lastName = String(data?.lastName || '').trim();
    const phone = String(data?.phone || '').trim();
    if (!firstName || !lastName) {
        throw new functions.https.HttpsError('invalid-argument', 'Nombre y apellidos son obligatorios.');
    }
    const patientDocRef = utils_1.db.collection('patients').doc();
    const now = (0, utils_1.getServerTimestamp)();
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
    await (0, utils_1.auditLog)(uid, 'create_patient_quick', 'patients', patientDocRef.id, {
        firstName,
        lastName,
        phone,
    });
    const patient = normalizePatient({ ...patientPayload, id: patientDocRef.id }, patientDocRef.id);
    return { patient };
};
exports.createQuickPatient = functions.https.onCall(createQuickPatientHandler);
exports.createQuickPatientHttp = (0, httpHelpers_1.makeHttpHandler)(createQuickPatientHandler);
const listDoctorsHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensureAgendaAccess(token?.role);
    const snap = await utils_1.db
        .collection('users')
        .where('role', 'in', ['doctor', 'specialist'])
        .limit(200)
        .get();
    const doctors = snap.docs.map(doc => normalizeUser({ ...doc.data(), id: doc.id }, doc.id));
    return { doctors };
};
exports.listDoctors = functions.https.onCall(listDoctorsHandler);
exports.listDoctorsHttp = (0, httpHelpers_1.makeHttpHandler)(listDoctorsHandler);
const listAppointmentTypesHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensureAgendaAccess(token?.role);
    const colRef = utils_1.db.collection('appointmentTypes');
    const snap = await colRef.get();
    if (snap.empty) {
        const batch = utils_1.db.batch();
        const now = (0, utils_1.getServerTimestamp)();
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
exports.listAppointmentTypes = functions.https.onCall(listAppointmentTypesHandler);
exports.listAppointmentTypesHttp = (0, httpHelpers_1.makeHttpHandler)(listAppointmentTypesHandler);
exports.__testables = {
    searchPatientsHandler,
};
