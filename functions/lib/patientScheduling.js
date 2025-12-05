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
exports.saveProviderScheduleHttp = exports.saveProviderSchedule = exports.getProviderScheduleHttp = exports.getProviderSchedule = exports.listPatientDoctorsHttp = exports.listPatientDoctors = exports.listPatientAppointmentTypesHttp = exports.listPatientAppointmentTypes = exports.requestAppointmentHttp = exports.requestAppointment = exports.getPatientAvailabilityHttp = exports.getPatientAvailability = void 0;
const functions = __importStar(require("firebase-functions"));
const utils_1 = require("./utils");
const httpHelpers_1 = require("./httpHelpers");
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;
const OCCUPIED_STATUSES = [
    'pending_confirmation',
    'confirmed',
    'checked_in',
    'in_progress',
    'attended_pending_payment',
    'completed',
];
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function normalizeTimeRange(raw) {
    if (!raw)
        return null;
    const start = typeof raw.start === 'string' ? raw.start.trim() : '';
    const end = typeof raw.end === 'string' ? raw.end.trim() : '';
    const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!pattern.test(start) || !pattern.test(end)) {
        return null;
    }
    if (start >= end) {
        return null;
    }
    return { start, end };
}
function isValidDateKey(value) {
    if (!value || typeof value !== 'string')
        return false;
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return false;
    }
    const parsed = new Date(`${trimmed}T00:00:00`);
    return !Number.isNaN(parsed.getTime());
}
async function loadProviderProfile(providerId, role) {
    const collection = role === 'specialist' ? 'specialistProfiles' : 'doctorProfiles';
    const docSnap = await utils_1.db.doc(`${collection}/${providerId}`).get();
    if (!docSnap.exists) {
        return {};
    }
    const data = docSnap.data();
    const result = {};
    if (data?.professionalLicense) {
        result.professionalLicense = String(data.professionalLicense);
    }
    if (Array.isArray(data?.specialties)) {
        result.specialties = data.specialties.map((item) => String(item)).filter(Boolean);
    }
    if (Array.isArray(data?.languages)) {
        result.languages = data.languages.map((item) => String(item)).filter(Boolean);
    }
    if (Number.isFinite(data?.yearsExperience)) {
        result.yearsExperience = Number(data.yearsExperience);
    }
    if (data?.bio) {
        result.bio = String(data.bio);
    }
    return result;
}
async function loadProviderSchedule(providerId) {
    const docSnap = await utils_1.db.doc(`providerSchedules/${providerId}`).get();
    if (!docSnap.exists) {
        return null;
    }
    const data = docSnap.data();
    const weeklyRaw = data?.weeklyAvailability && typeof data.weeklyAvailability === 'object' ? data.weeklyAvailability : {};
    const weeklyAvailability = {
        sunday: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
    };
    for (const key of WEEKDAY_KEYS) {
        const rangesRaw = Array.isArray(weeklyRaw?.[key]) ? weeklyRaw[key] : [];
        weeklyAvailability[key] = rangesRaw
            .map(normalizeTimeRange)
            .filter((range) => !!range);
    }
    const overrides = {};
    if (data?.overrides && typeof data.overrides === 'object') {
        for (const [dateKey, value] of Object.entries(data.overrides)) {
            if (!isValidDateKey(dateKey) || !Array.isArray(value)) {
                continue;
            }
            const normalized = value
                .map(item => normalizeTimeRange(item))
                .filter((range) => !!range);
            overrides[dateKey] = normalized;
        }
    }
    let blockedDates = [];
    if (Array.isArray(data?.blockedDates)) {
        const filtered = data.blockedDates
            .map((item) => String(item).trim())
            .filter(isValidDateKey);
        const unique = new Set(filtered);
        blockedDates = Array.from(unique);
    }
    return {
        providerId: docSnap.id,
        timezone: data?.timezone ? String(data.timezone) : undefined,
        slotDurationMinutes: Number.isFinite(data?.slotDurationMinutes) ? Number(data.slotDurationMinutes) : undefined,
        weeklyAvailability,
        overrides,
        blockedDates,
    };
}
function applyTimeToDate(base, time) {
    const parts = time.split(':');
    if (parts.length !== 2)
        return null;
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute))
        return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59)
        return null;
    const result = new Date(base);
    result.setHours(hour, minute, 0, 0);
    return result;
}
function resolveScheduleWindows(schedule, targetDate) {
    if (!schedule) {
        const { start, end } = buildWorkdayWindow(targetDate);
        return [{ start, end }];
    }
    const baseDate = new Date(targetDate);
    baseDate.setHours(0, 0, 0, 0);
    const dateKey = baseDate.toISOString().split('T')[0];
    if (schedule.blockedDates.includes(dateKey)) {
        return [];
    }
    const overrideRanges = schedule.overrides[dateKey];
    const weekdayIndex = baseDate.getUTCDay();
    const weekdayKey = WEEKDAY_KEYS[weekdayIndex];
    const rangesSource = Array.isArray(overrideRanges) ? overrideRanges : schedule.weeklyAvailability[weekdayKey] || [];
    const windows = [];
    for (const range of rangesSource) {
        const start = applyTimeToDate(baseDate, range.start);
        const end = applyTimeToDate(baseDate, range.end);
        if (!start || !end || end.getTime() <= start.getTime()) {
            continue;
        }
        windows.push({ start, end });
    }
    if (windows.length === 0 && !overrideRanges) {
        // Fallback to default business hours when no schedule is defined for the day.
        const { start, end } = buildWorkdayWindow(baseDate);
        return [{ start, end }];
    }
    return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}
function getSlotDurationMinutes(schedule, appointmentDuration) {
    if (!schedule || !Number.isFinite(schedule.slotDurationMinutes || NaN)) {
        return appointmentDuration;
    }
    const slotLength = Number(schedule.slotDurationMinutes);
    if (slotLength <= 0) {
        return appointmentDuration;
    }
    return Math.max(slotLength, appointmentDuration);
}
function ensureProviderManagementAccess(role) {
    const allowed = ['doctor', 'specialist', 'admin', 'receptionist'];
    if (!role || !allowed.includes(role)) {
        throw new functions.https.HttpsError('permission-denied', 'No autorizado para gestionar horarios.');
    }
}
function ensurePatientAccess(role) {
    if (!role) {
        throw new functions.https.HttpsError('permission-denied', 'Autenticación requerida.');
    }
    const allowed = ['patient', 'admin', 'receptionist'];
    if (!allowed.includes(role)) {
        throw new functions.https.HttpsError('permission-denied', 'No autorizado para solicitar citas.');
    }
}
async function resolvePatientProfile(uid) {
    const patientSnap = await utils_1.db.collection('patients').where('authUid', '==', uid).limit(1).get();
    if (patientSnap.empty) {
        throw new functions.https.HttpsError('failed-precondition', 'Debe completar su perfil de paciente antes de solicitar una cita.');
    }
    const doc = patientSnap.docs[0];
    const data = doc.data();
    return {
        id: doc.id,
        firstName: String(data?.firstName || ''),
        lastName: String(data?.lastName || ''),
        contactInfo: {
            email: String(data?.contactInfo?.email || ''),
            phone: String(data?.contactInfo?.phone || ''),
            address: String(data?.contactInfo?.address || ''),
        },
        insuranceInfo: Array.isArray(data?.insuranceInfo) ? data.insuranceInfo : [],
        allergies: Array.isArray(data?.allergies) ? data.allergies : [],
        chronicConditions: Array.isArray(data?.chronicConditions) ? data.chronicConditions : [],
        avatarUrl: data?.avatarUrl || undefined,
        clinicId: data?.clinicId || null,
    };
}
async function resolveAppointmentType(typeId) {
    const snap = await utils_1.db.doc(`appointmentTypes/${typeId}`).get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('invalid-argument', 'Tipo de cita inválido.');
    }
    const data = snap.data();
    return {
        id: snap.id,
        name: String(data?.name || ''),
        durationMinutes: Number.isFinite(data?.durationMinutes) ? Number(data.durationMinutes) : 30,
        price: Number.isFinite(data?.price) ? Number(data.price) : 0,
        description: data?.description || '',
    };
}
async function hydrateDoctorSnapshot(docSnap) {
    const data = docSnap.data();
    const profile = await loadProviderProfile(docSnap.id, data?.role);
    const specialties = Array.isArray(profile.specialties) ? profile.specialties : [];
    const languages = Array.isArray(profile.languages) ? profile.languages : [];
    return {
        id: docSnap.id,
        name: String(data?.name || ''),
        email: data?.email || undefined,
        role: data?.role || undefined,
        phone: data?.phone || undefined,
        isActive: data?.isActive !== false,
        clinicId: data?.clinicId || null,
        professionalLicense: profile.professionalLicense,
        specialties,
        languages,
        yearsExperience: profile.yearsExperience,
        bio: profile.bio,
    };
}
async function listDoctorsForScheduling(doctorId) {
    if (doctorId && doctorId !== 'any') {
        const snap = await utils_1.db.doc(`users/${doctorId}`).get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('invalid-argument', 'Doctor inválido.');
        }
        const data = snap.data();
        if (data?.role !== 'doctor' && data?.role !== 'specialist') {
            throw new functions.https.HttpsError('invalid-argument', 'El profesional seleccionado no es un doctor.');
        }
        const doctor = await hydrateDoctorSnapshot(snap);
        return [doctor];
    }
    const snap = await utils_1.db
        .collection('users')
        .where('role', 'in', ['doctor', 'specialist'])
        .limit(50)
        .get();
    const doctors = await Promise.all(snap.docs.map(hydrateDoctorSnapshot));
    return doctors.filter(doc => doc.isActive !== false);
}
function buildWorkdayWindow(date) {
    const start = new Date(date);
    start.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
    const end = new Date(date);
    end.setHours(WORK_DAY_END_HOUR, 0, 0, 0);
    return { start, end };
}
function slotOverlaps(slotStart, slotEnd, appointment) {
    const startIso = (0, utils_1.toIsoString)(appointment?.startTime);
    const endIso = (0, utils_1.toIsoString)(appointment?.endTime);
    if (!startIso || !endIso)
        return false;
    const start = new Date(startIso);
    const end = new Date(endIso);
    const status = appointment?.status;
    if (!OCCUPIED_STATUSES.includes(status)) {
        return false;
    }
    return slotStart < end && slotEnd > start;
}
function buildDoctorSlots(appointments, durationMinutes, windows) {
    if (windows.length === 0) {
        return [];
    }
    const slots = [];
    const durationMs = durationMinutes * 60000;
    const now = Date.now();
    for (const window of windows) {
        let cursor = new Date(window.start);
        while (cursor.getTime() + durationMs <= window.end.getTime()) {
            const slotStart = new Date(cursor);
            const slotEnd = new Date(cursor.getTime() + durationMs);
            const inPast = slotStart.getTime() < now;
            if (!inPast) {
                const overlaps = appointments.some(app => slotOverlaps(slotStart, slotEnd, app.data()));
                if (!overlaps) {
                    slots.push({ startTime: slotStart.toISOString(), endTime: slotEnd.toISOString() });
                }
            }
            cursor = new Date(cursor.getTime() + durationMs);
        }
    }
    return slots;
}
const getPatientAvailabilityHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensurePatientAccess(token?.role);
    const dateIso = String(data?.date || '').trim();
    const typeId = String(data?.appointmentTypeId || '').trim();
    const doctorId = data?.doctorId ? String(data.doctorId) : undefined;
    if (!dateIso) {
        throw new functions.https.HttpsError('invalid-argument', 'La fecha es obligatoria.');
    }
    if (!typeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe seleccionar un tipo de cita.');
    }
    const targetDate = new Date(dateIso);
    if (Number.isNaN(targetDate.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'Fecha inválida.');
    }
    const appointmentType = await resolveAppointmentType(typeId);
    const doctors = await listDoctorsForScheduling(doctorId);
    if (doctors.length === 0) {
        return { availability: [] };
    }
    const startOfWindow = new Date(targetDate);
    startOfWindow.setHours(0, 0, 0, 0);
    const endOfWindow = new Date(targetDate);
    endOfWindow.setHours(23, 59, 59, 999);
    const availability = [];
    for (const doctor of doctors) {
        const schedule = await loadProviderSchedule(doctor.id);
        const windows = resolveScheduleWindows(schedule, targetDate);
        const slotDurationMinutes = getSlotDurationMinutes(schedule, appointmentType.durationMinutes);
        const querySnap = await utils_1.db
            .collection('appointments')
            .where('doctorId', '==', doctor.id)
            .where('startTime', '>=', startOfWindow)
            .where('startTime', '<=', endOfWindow)
            .get();
        const slots = buildDoctorSlots(querySnap.docs, slotDurationMinutes, windows);
        if (slots.length > 0) {
            availability.push({
                doctorId: doctor.id,
                doctorName: doctor.name,
                clinicId: doctor.clinicId || null,
                slots,
                professionalLicense: doctor.professionalLicense,
                specialties: doctor.specialties || [],
                languages: doctor.languages || [],
                yearsExperience: doctor.yearsExperience,
                bio: doctor.bio,
                timezone: schedule?.timezone,
            });
        }
        else if (!doctorId || doctorId === 'any') {
            availability.push({
                doctorId: doctor.id,
                doctorName: doctor.name,
                clinicId: doctor.clinicId || null,
                slots: [],
                professionalLicense: doctor.professionalLicense,
                specialties: doctor.specialties || [],
                languages: doctor.languages || [],
                yearsExperience: doctor.yearsExperience,
                bio: doctor.bio,
                timezone: schedule?.timezone,
            });
        }
    }
    return { availability };
};
const listPatientAppointmentTypesHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensurePatientAccess(token?.role);
    const snap = await utils_1.db.collection('appointmentTypes').limit(100).get();
    const appointmentTypes = snap.docs.map(doc => {
        const dataDoc = doc.data();
        return {
            id: doc.id,
            name: String(dataDoc?.name || ''),
            durationMinutes: Number.isFinite(dataDoc?.durationMinutes) ? Number(dataDoc.durationMinutes) : 30,
            price: Number.isFinite(dataDoc?.price) ? Number(dataDoc.price) : 0,
            description: dataDoc?.description || '',
        };
    }).filter(type => type.name.trim().length > 0);
    appointmentTypes.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return { appointmentTypes };
};
const listPatientDoctorsHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensurePatientAccess(token?.role);
    const doctors = await listDoctorsForScheduling(data?.doctorId ? String(data.doctorId) : undefined);
    const normalized = doctors
        .filter(doc => doc.isActive !== false)
        .map(doc => ({
        id: doc.id,
        name: doc.name || 'Profesional disponible',
        email: doc.email,
        role: doc.role,
        phone: doc.phone,
        clinicId: doc.clinicId || null,
        isActive: doc.isActive !== false,
        professionalLicense: doc.professionalLicense,
        specialties: doc.specialties || [],
        languages: doc.languages || [],
        yearsExperience: doc.yearsExperience,
        bio: doc.bio,
    }));
    normalized.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return { doctors: normalized };
};
const requestAppointmentHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    ensurePatientAccess(token?.role);
    const appointmentTypeId = String(data?.appointmentTypeId || '').trim();
    const doctorIdRaw = String(data?.doctorId || '').trim();
    const startTimeIso = String(data?.startTime || '').trim();
    const reason = data?.reason ? String(data.reason).trim() : undefined;
    const modality = data?.modality ? String(data.modality).trim() : undefined;
    const notes = data?.notes ? String(data.notes).trim() : undefined;
    const contactPhone = data?.contactPhone ? String(data.contactPhone).trim() : undefined;
    const contactEmail = data?.contactEmail ? String(data.contactEmail).trim() : undefined;
    if (!appointmentTypeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe seleccionar una especialidad.');
    }
    if (!startTimeIso) {
        throw new functions.https.HttpsError('invalid-argument', 'Debe seleccionar un horario disponible.');
    }
    const patientProfile = await resolvePatientProfile(uid);
    const appointmentType = await resolveAppointmentType(appointmentTypeId);
    let doctorCandidates = await listDoctorsForScheduling(doctorIdRaw || 'any');
    if (doctorCandidates.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'No hay doctores disponibles para este tipo de cita.');
    }
    let doctor = undefined;
    if (doctorIdRaw && doctorIdRaw !== 'any') {
        doctor = doctorCandidates.find(d => d.id === doctorIdRaw);
        if (!doctor) {
            throw new functions.https.HttpsError('invalid-argument', 'Doctor seleccionado inválido.');
        }
    }
    const requestedStart = new Date(startTimeIso);
    if (Number.isNaN(requestedStart.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'Horario seleccionado inválido.');
    }
    const now = new Date();
    if (requestedStart.getTime() < now.getTime()) {
        throw new functions.https.HttpsError('failed-precondition', 'Seleccione un horario futuro.');
    }
    const requestedEnd = new Date(requestedStart.getTime() + appointmentType.durationMinutes * 60000);
    const startOfDay = new Date(requestedStart);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(requestedStart);
    endOfDay.setHours(23, 59, 59, 999);
    if (!doctor) {
        for (const candidate of doctorCandidates) {
            const conflictSnap = await utils_1.db
                .collection('appointments')
                .where('doctorId', '==', candidate.id)
                .where('startTime', '>=', startOfDay)
                .where('startTime', '<=', endOfDay)
                .get();
            const hasConflict = conflictSnap.docs.some(doc => slotOverlaps(requestedStart, requestedEnd, doc.data()));
            if (!hasConflict) {
                doctor = candidate;
                break;
            }
        }
        if (!doctor) {
            throw new functions.https.HttpsError('failed-precondition', 'No se encontró disponibilidad para el horario seleccionado.');
        }
    }
    else {
        const conflictSnap = await utils_1.db
            .collection('appointments')
            .where('doctorId', '==', doctor.id)
            .where('startTime', '>=', startOfDay)
            .where('startTime', '<=', endOfDay)
            .get();
        const hasConflict = conflictSnap.docs.some(doc => slotOverlaps(requestedStart, requestedEnd, doc.data()));
        if (hasConflict) {
            throw new functions.https.HttpsError('already-exists', 'El horario seleccionado ya fue reservado.');
        }
    }
    if (!doctor) {
        throw new functions.https.HttpsError('failed-precondition', 'No se pudo asignar un doctor disponible.');
    }
    const doctorSnapshot = await utils_1.db.doc(`users/${doctor.id}`).get();
    const doctorData = doctorSnapshot.data() || {};
    const payload = {
        patientId: patientProfile.id,
        doctorId: doctor.id,
        typeId: appointmentType.id,
        startTime: requestedStart,
        endTime: requestedEnd,
        status: 'pending_confirmation',
        notes: notes || null,
        clinicId: doctor.clinicId || patientProfile.clinicId || null,
        createdAt: (0, utils_1.getServerTimestamp)(),
        updatedAt: (0, utils_1.getServerTimestamp)(),
        createdBy: { uid, role: token?.role || 'patient', source: 'patient_portal' },
        patientSnapshot: (0, utils_1.sanitizeForFirestore)({
            id: patientProfile.id,
            firstName: patientProfile.firstName,
            lastName: patientProfile.lastName,
            contactInfo: patientProfile.contactInfo,
            insuranceInfo: patientProfile.insuranceInfo,
            allergies: patientProfile.allergies,
            chronicConditions: patientProfile.chronicConditions,
            avatarUrl: patientProfile.avatarUrl || '',
            clinicId: patientProfile.clinicId || null,
        }),
        doctorSnapshot: (0, utils_1.sanitizeForFirestore)({
            id: doctor.id,
            name: doctorData?.name || doctor.name,
            email: doctorData?.email || '',
            role: doctorData?.role || 'doctor',
            avatarUrl: doctorData?.avatarUrl || '',
            phone: doctorData?.phone || '',
            clinicId: doctorData?.clinicId || null,
        }),
        typeSnapshot: (0, utils_1.sanitizeForFirestore)({
            id: appointmentType.id,
            name: appointmentType.name,
            durationMinutes: appointmentType.durationMinutes,
            price: appointmentType.price,
            description: appointmentType.description,
        }),
        requestDetails: (0, utils_1.sanitizeForFirestore)({
            reason: reason || null,
            modality: modality || 'presencial',
            contactPhone: contactPhone || patientProfile.contactInfo.phone,
            contactEmail: contactEmail || patientProfile.contactInfo.email,
        }),
    };
    const docRef = utils_1.db.collection('appointments').doc();
    await docRef.set(payload);
    await utils_1.db.collection('appointmentRequests').doc(docRef.id).set({
        appointmentId: docRef.id,
        patientId: patientProfile.id,
        doctorId: doctor.id,
        typeId: appointmentType.id,
        status: 'pending_confirmation',
        createdAt: (0, utils_1.getServerTimestamp)(),
        requestedStart: requestedStart,
        requestedEnd: requestedEnd,
        reason: reason || null,
    });
    return {
        appointmentId: docRef.id,
        doctorId: doctor.id,
        startTime: requestedStart.toISOString(),
        endTime: requestedEnd.toISOString(),
    };
};
const getProviderScheduleHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    const role = token?.role;
    ensureProviderManagementAccess(role);
    let providerId = typeof data?.providerId === 'string' ? data.providerId.trim() : '';
    if (!providerId || role === 'doctor' || role === 'specialist') {
        providerId = providerId || uid;
    }
    if (!providerId) {
        throw new functions.https.HttpsError('invalid-argument', 'providerId requerido.');
    }
    if ((role === 'doctor' || role === 'specialist') && providerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'No puede consultar los horarios de otros profesionales.');
    }
    const schedule = await loadProviderSchedule(providerId);
    if (!schedule) {
        return {
            providerId,
            schedule: null,
        };
    }
    return {
        providerId,
        schedule: {
            providerId: schedule.providerId,
            timezone: schedule.timezone || null,
            slotDurationMinutes: schedule.slotDurationMinutes || null,
            weeklyAvailability: schedule.weeklyAvailability,
            overrides: schedule.overrides,
            blockedDates: schedule.blockedDates,
        },
    };
};
const saveProviderScheduleHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    const role = token?.role;
    ensureProviderManagementAccess(role);
    let providerId = typeof data?.providerId === 'string' ? data.providerId.trim() : '';
    if (!providerId || role === 'doctor' || role === 'specialist') {
        providerId = providerId || uid;
    }
    if (!providerId) {
        throw new functions.https.HttpsError('invalid-argument', 'providerId requerido.');
    }
    if ((role === 'doctor' || role === 'specialist') && providerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'No puede actualizar los horarios de otros profesionales.');
    }
    const timezone = typeof data?.timezone === 'string' ? data.timezone.trim() : undefined;
    const durationRaw = Number(data?.slotDurationMinutes);
    const slotDurationMinutes = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : undefined;
    const weeklyInput = data?.weeklyAvailability && typeof data.weeklyAvailability === 'object' ? data.weeklyAvailability : {};
    const overridesInput = data?.overrides && typeof data.overrides === 'object' ? data.overrides : {};
    const blockedInput = Array.isArray(data?.blockedDates) ? data.blockedDates : [];
    const weeklyAvailability = {
        sunday: [],
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
    };
    for (const key of WEEKDAY_KEYS) {
        const rangesRaw = Array.isArray(weeklyInput[key]) ? weeklyInput[key] : [];
        weeklyAvailability[key] = rangesRaw
            .map(item => normalizeTimeRange(item))
            .filter((range) => !!range);
    }
    const overrides = {};
    for (const [dateKey, value] of Object.entries(overridesInput)) {
        if (!isValidDateKey(dateKey) || !Array.isArray(value)) {
            continue;
        }
        const normalized = value
            .map(item => normalizeTimeRange(item))
            .filter((range) => !!range);
        overrides[dateKey] = normalized;
    }
    const blockedDates = Array.from(new Set(blockedInput
        .map((item) => String(item).trim())
        .filter(isValidDateKey)));
    const payload = (0, utils_1.sanitizeForFirestore)({
        providerId,
        timezone: timezone || null,
        slotDurationMinutes: slotDurationMinutes || null,
        weeklyAvailability,
        overrides,
        blockedDates,
        updatedAt: (0, utils_1.getServerTimestamp)(),
        updatedBy: {
            uid,
            role: role || 'unknown',
        },
    });
    await utils_1.db.doc(`providerSchedules/${providerId}`).set(payload, { merge: true });
    return {
        providerId,
        saved: true,
    };
};
exports.getPatientAvailability = functions.https.onCall(getPatientAvailabilityHandler);
exports.getPatientAvailabilityHttp = (0, httpHelpers_1.makeHttpHandler)(getPatientAvailabilityHandler);
exports.requestAppointment = functions.https.onCall(requestAppointmentHandler);
exports.requestAppointmentHttp = (0, httpHelpers_1.makeHttpHandler)(requestAppointmentHandler);
exports.listPatientAppointmentTypes = functions.https.onCall(listPatientAppointmentTypesHandler);
exports.listPatientAppointmentTypesHttp = (0, httpHelpers_1.makeHttpHandler)(listPatientAppointmentTypesHandler);
exports.listPatientDoctors = functions.https.onCall(listPatientDoctorsHandler);
exports.listPatientDoctorsHttp = (0, httpHelpers_1.makeHttpHandler)(listPatientDoctorsHandler);
exports.getProviderSchedule = functions.https.onCall(getProviderScheduleHandler);
exports.getProviderScheduleHttp = (0, httpHelpers_1.makeHttpHandler)(getProviderScheduleHandler);
exports.saveProviderSchedule = functions.https.onCall(saveProviderScheduleHandler);
exports.saveProviderScheduleHttp = (0, httpHelpers_1.makeHttpHandler)(saveProviderScheduleHandler);
