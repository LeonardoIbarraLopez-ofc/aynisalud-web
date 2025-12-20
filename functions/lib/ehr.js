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
exports.addEhrEventHttp = exports.addEhrEvent = exports.getPatientEhrHttp = exports.getPatientEhr = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const uuid_1 = require("uuid");
const utils_1 = require("./utils");
const httpHelpers_1 = require("./httpHelpers");
const TIMELINE_TYPE_MAP = {
    consultation_note: 'ConsultationNote',
    clinical_note: 'ConsultationNote',
    lab_result: 'LabResult',
    prescription: 'Prescription',
    imaging_study: 'ImageStudy',
    procedure: 'Procedure',
    vital_sign: 'Vital',
    document: 'Document',
};
function ensureReadAccess(patient, patientId, callerUid, token) {
    const allowed = (patient.authUid && patient.authUid === callerUid) || (0, utils_1.isAdmin)(token);
    if (allowed) {
        return;
    }
    const authorizedClinicians = Array.isArray(patient.authorizedClinicians)
        ? patient.authorizedClinicians
        : [];
    if (authorizedClinicians.includes(callerUid) || (0, utils_1.isClinician)(token)) {
        return;
    }
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to read EHR for this patient');
}
function ensureWriteAccess(patient, callerUid, token) {
    const allowed = (0, utils_1.isClinician)(token) || (0, utils_1.isAdmin)(token);
    if (allowed) {
        return;
    }
    if (patient.authUid && patient.authUid === callerUid) {
        return;
    }
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to update EHR for this patient');
}
function normalizePatient(docId, data) {
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
function toTimestamp(value) {
    if (value) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return admin.firestore.Timestamp.fromDate(parsed);
        }
    }
    return admin.firestore.Timestamp.fromDate(new Date());
}
function sanitizeStringArray(values) {
    if (!Array.isArray(values))
        return [];
    return values
        .map(item => String(item || '').trim())
        .filter(item => item.length > 0);
}
function sanitizePrescriptions(values) {
    if (!Array.isArray(values))
        return [];
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
function sanitizeLabOrders(values) {
    if (!Array.isArray(values))
        return [];
    return values
        .map(item => ({
        id: item?.id ? String(item.id) : undefined,
        testName: String(item?.testName || ''),
        details: item?.details ? String(item.details) : undefined,
    }))
        .filter(item => item.testName.length > 0);
}
function sanitizeLabResults(values) {
    if (!Array.isArray(values))
        return [];
    return values
        .map(item => ({
        id: item?.id ? String(item.id) : undefined,
        testName: String(item?.testName || ''),
        resultValue: item?.resultValue ? String(item.resultValue) : undefined,
        unit: item?.unit ? String(item.unit) : undefined,
        referenceRange: item?.referenceRange ? String(item.referenceRange) : undefined,
        interpretation: item?.interpretation ? String(item.interpretation) : undefined,
        notes: item?.notes ? String(item.notes) : undefined,
    }))
        .filter(item => item.testName.length > 0);
}
function sanitizeVitals(values) {
    if (!Array.isArray(values))
        return [];
    return values
        .map(item => ({
        id: item?.id ? String(item.id) : undefined,
        name: String(item?.name || ''),
        value: String(item?.value || ''),
        unit: item?.unit ? String(item.unit) : undefined,
    }))
        .filter(item => item.name.length > 0 && item.value.length > 0);
}
function sanitizeDocuments(values) {
    if (!Array.isArray(values))
        return [];
    return values
        .map(item => ({
        id: item?.id ? String(item.id) : undefined,
        title: String(item?.title || ''),
        url: item?.url ? String(item.url) : undefined,
        description: item?.description ? String(item.description) : undefined,
        type: item?.type ? String(item.type) : undefined,
    }))
        .filter(item => item.title.length > 0);
}
function sanitizeSoapNote(value) {
    if (!value || typeof value !== 'object')
        return undefined;
    const subject = value.subjective ? String(value.subjective) : undefined;
    const objective = value.objective ? String(value.objective) : undefined;
    const assessment = value.assessment ? String(value.assessment) : undefined;
    const plan = value.plan ? String(value.plan) : undefined;
    if (subject || objective || assessment || plan) {
        return { subjective: subject, objective, assessment, plan };
    }
    return undefined;
}
function mapTimelineEvent(doc) {
    const data = doc.data();
    const rawType = String(data?.type || '').toLowerCase() || 'clinical_note';
    const presentationType = TIMELINE_TYPE_MAP[rawType] || 'ConsultationNote';
    const performedAt = (0, utils_1.toIsoString)(data?.performedAt) || (0, utils_1.toIsoString)(data?.date) || new Date().toISOString();
    const actorName = String(data?.actor?.name || data?.actorName || 'Profesional de salud');
    const metadata = {};
    if (data?.details)
        metadata.details = String(data.details);
    if (data?.soapNote)
        metadata.soapNote = data.soapNote;
    if (Array.isArray(data?.prescriptions))
        metadata.prescriptions = data.prescriptions;
    if (Array.isArray(data?.labOrders))
        metadata.labOrders = data.labOrders;
    if (Array.isArray(data?.labResults))
        metadata.labResults = data.labResults;
    if (Array.isArray(data?.vitals))
        metadata.vitals = data.vitals;
    if (Array.isArray(data?.attachments))
        metadata.attachments = data.attachments;
    if (data?.appointmentId)
        metadata.appointmentId = data.appointmentId;
    if (data?.status)
        metadata.status = data.status;
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
function buildSnapshot(patient, timeline) {
    const snapshot = [];
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
        const meds = latestPrescription.metadata?.prescriptions;
        const details = meds
            .map(item => {
            const pieces = [item.medicationName];
            if (item.dosage)
                pieces.push(item.dosage);
            if (item.frequency)
                pieces.push(item.frequency);
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
        const labItems = latestLab.metadata?.labResults;
        const labDetails = labItems && labItems.length > 0
            ? labItems
                .map(item => {
                const pieces = [item.testName];
                if (item.resultValue)
                    pieces.push(item.resultValue);
                if (item.unit)
                    pieces.push(item.unit);
                if (item.referenceRange)
                    pieces.push(`Ref: ${item.referenceRange}`);
                return pieces.join(' • ');
            })
                .join('\n')
            : latestLab.summary;
        snapshot.push({
            type: 'note',
            title: latestLab.title,
            details: labDetails,
            date: latestLab.date,
            source: latestLab.actor,
            tags: latestLab.tags,
        });
    }
    const latestVital = timeline.find(event => event.type === 'Vital' && event.metadata?.vitals?.length);
    if (latestVital) {
        const vitals = latestVital.metadata?.vitals;
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
const getPatientEhrHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    let patientId = String(data?.patientId || '').trim();
    const limitRaw = Number(data?.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 200;
    const since = data?.since ? new Date(String(data.since)) : null;
    let patientDocSnapshot = null;
    if (!patientId && token?.role === 'patient') {
        const ownPatientQuery = await utils_1.db
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
        patientDocSnapshot = await utils_1.db.doc(`patients/${patientId}`).get();
    }
    if (!patientDocSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'patient not found');
    }
    const patientData = patientDocSnapshot.data();
    ensureReadAccess(patientData, patientId, uid, token);
    await (0, utils_1.auditLog)(uid, 'read_ehr', 'patients', patientId, { limit, since: since ? since.toISOString() : null });
    let query = utils_1.db
        .collection(`patients/${patientId}/timeline`)
        .orderBy('performedAt', 'desc')
        .limit(limit);
    if (since) {
        query = query.where('performedAt', '>=', since);
    }
    const timelineSnap = await query.get();
    const timeline = timelineSnap.docs
        .map(mapTimelineEvent)
        .filter((event) => !!event);
    const patient = normalizePatient(patientId, patientData);
    const snapshot = buildSnapshot(patient, timeline);
    const patientDocMeta = patientDocSnapshot;
    const fallbackLastUpdated = (0, utils_1.toIsoString)(patientDocMeta?.updateTime) ||
        (0, utils_1.toIsoString)(patientDocMeta?.createTime) ||
        new Date().toISOString();
    const stats = {
        totalEvents: timelineSnap.size,
        lastUpdated: timeline.length > 0
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
const addEhrEventHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    const patientId = String(data?.patientId || '').trim();
    const eventPayload = data?.event || {};
    if (!patientId) {
        throw new functions.https.HttpsError('invalid-argument', 'patientId required');
    }
    if (!eventPayload || typeof eventPayload !== 'object') {
        throw new functions.https.HttpsError('invalid-argument', 'event payload required');
    }
    const typeRaw = String(eventPayload.type || '').toLowerCase();
    const allowedTypes = [
        'consultation_note',
        'clinical_note',
        'lab_result',
        'prescription',
        'imaging_study',
        'procedure',
        'vital_sign',
        'document',
    ];
    if (!allowedTypes.includes(typeRaw)) {
        throw new functions.https.HttpsError('invalid-argument', 'Unsupported event type');
    }
    const patientSnap = await utils_1.db.doc(`patients/${patientId}`).get();
    if (!patientSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'patient not found');
    }
    const patientData = patientSnap.data();
    ensureWriteAccess(patientData, uid, token);
    const actorSnap = await utils_1.db.doc(`users/${uid}`).get().catch(() => null);
    const actorData = actorSnap && actorSnap.exists ? actorSnap.data() : null;
    const soapNote = sanitizeSoapNote(eventPayload.soapNote);
    const prescriptions = sanitizePrescriptions(eventPayload.prescriptions);
    const labOrders = sanitizeLabOrders(eventPayload.labOrders);
    const labResults = sanitizeLabResults(eventPayload.labResults);
    const vitals = sanitizeVitals(eventPayload.vitals);
    const documents = sanitizeDocuments(eventPayload.documents);
    const tags = sanitizeStringArray(eventPayload.tags);
    const eventDoc = {
        type: typeRaw || 'clinical_note',
        title: String(eventPayload.title || 'Registro clínico'),
        summary: String(eventPayload.summary || ''),
        details: eventPayload.details ? String(eventPayload.details) : undefined,
        tags,
        appointmentId: eventPayload.appointmentId ? String(eventPayload.appointmentId) : null,
        status: eventPayload.status ? String(eventPayload.status) : 'final',
        performedAt: toTimestamp(eventPayload.performedAt),
        soapNote,
        prescriptions,
        labOrders,
        labResults,
        vitals,
        attachments: documents,
        actor: {
            uid: uid,
            name: actorData?.name || String(eventPayload.actorName || ''),
            role: token?.role || null,
            email: actorData?.email || null,
        },
        createdAt: (0, utils_1.getServerTimestamp)(),
        updatedAt: (0, utils_1.getServerTimestamp)(),
    };
    const eventId = (0, uuid_1.v4)();
    const timelineRef = utils_1.db.doc(`patients/${patientId}/timeline/${eventId}`);
    const searchableRef = utils_1.db.collection('ehrEvents_searchable').doc(eventId);
    const batch = utils_1.db.batch();
    batch.set(timelineRef, (0, utils_1.sanitizeForFirestore)(eventDoc));
    const searchableDoc = (0, utils_1.sanitizeForFirestore)({
        eventId,
        patientId,
        clinicId: patientData?.clinicId || null,
        date: eventDoc.performedAt,
        type: eventDoc.type,
        code: eventPayload.code ? String(eventPayload.code) : null,
        actorDoctorId: uid,
        createdAt: (0, utils_1.getServerTimestamp)(),
        title: eventDoc.title,
        summary: eventDoc.summary,
        tags,
        prescriptionCount: eventDoc.prescriptions?.length || 0,
        labOrderCount: eventDoc.labOrders?.length || 0,
        labResultCount: eventDoc.labResults?.length || 0,
    });
    batch.set(searchableRef, searchableDoc);
    await batch.commit();
    await (0, utils_1.auditLog)(uid, 'create_ehr_event', 'patients', patientId, {
        eventId,
        type: eventDoc.type,
        appointmentId: eventDoc.appointmentId || null,
    });
    return {
        eventId,
        patientId,
    };
};
exports.getPatientEhr = functions.https.onCall(getPatientEhrHandler);
exports.getPatientEhrHttp = (0, httpHelpers_1.makeHttpHandler)(getPatientEhrHandler);
exports.addEhrEvent = functions.https.onCall(addEhrEventHandler);
exports.addEhrEventHttp = (0, httpHelpers_1.makeHttpHandler)(addEhrEventHandler);
