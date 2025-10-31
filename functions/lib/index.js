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
exports.addEhrEvent = exports.getPatientEhr = exports.setCustomClaims = exports.linkPatient = exports.updateProfile = exports.createUserAdmin = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const uuid_1 = require("uuid");
const utils_1 = require("./utils");
// Initialize the Admin SDK before loading modules that may call admin APIs
// during top-level initialization. We use a runtime require for `users` so
// that admin.initializeApp() runs first and prevents "default app does not exist" errors.
if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp();
}
// Load side-effect modules after initialization and re-export their callables
// so the Functions emulator detects them as top-level exports.
const users = require('./users');
// Re-export user callables from the main entry to ensure firebase-tools
// discovers them when the codebase `main` points to this file.
exports.createUserAdmin = users.createUserAdmin;
exports.updateProfile = users.updateProfile;
exports.linkPatient = users.linkPatient;
exports.setCustomClaims = users.setCustomClaims;
// Callable: getPatientEhr
exports.getPatientEhr = functions.https.onCall(async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    const { patientId } = data || {};
    let { limit = 100, since } = data || {};
    limit = Math.min(Number(limit) || 100, 500);
    if (!patientId)
        throw new functions.https.HttpsError('invalid-argument', 'patientId required');
    // Authorization policy (server-side): patient himself OR clinician assigned OR admin
    const patientDoc = await utils_1.db.doc(`patients/${patientId}`).get();
    if (!patientDoc.exists)
        throw new functions.https.HttpsError('not-found', 'patient not found');
    const patient = patientDoc.data();
    const callerUid = uid;
    const allowed = (patient.authUid && patient.authUid === callerUid)
        || (Array.isArray(patient.authorizedClinicians) && patient.authorizedClinicians.includes(callerUid))
        || (0, utils_1.isAdmin)(token);
    if (!allowed) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to read EHR for this patient');
    }
    // Audit
    await (0, utils_1.auditLog)(callerUid, 'read_ehr', 'patients', patientId, { limit, since });
    // Query timeline subcollection (secure server-side)
    let q = utils_1.db.collection(`patients/${patientId}/timeline`).orderBy('date', 'desc').limit(limit);
    if (since)
        q = q.where('date', '>=', new Date(since));
    const snap = await q.get();
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { patientId, events };
});
// Callable: addEhrEvent
exports.addEhrEvent = functions.https.onCall(async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    const { patientId, event } = data || {};
    if (!patientId || !event || !event.type)
        throw new functions.https.HttpsError('invalid-argument', 'patientId and event.type required');
    const callerUid = uid;
    const patientSnap = await utils_1.db.doc(`patients/${patientId}`).get();
    if (!patientSnap.exists)
        throw new functions.https.HttpsError('not-found', 'patient not found');
    const patient = patientSnap.data();
    // Only clinicians or admin or the patient (for personal notes) can add events
    const allowedToWrite = (0, utils_1.isClinician)(token) || (0, utils_1.isAdmin)(token) || (patient.authUid && patient.authUid === callerUid);
    if (!allowedToWrite)
        throw new functions.https.HttpsError('permission-denied', 'Not authorized to add EHR event');
    // Create a new event id
    const eventId = (0, uuid_1.v4)();
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
    const timelineRef = utils_1.db.doc(`patients/${patientId}/timeline/${eventId}`);
    const searchableRef = utils_1.db.collection('ehrEvents_searchable').doc(eventId);
    // Use a batch for atomic-ish write (both will either be written or not) -- Firestore batch is atomic per 500 writes
    const batch = utils_1.db.batch();
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
    await (0, utils_1.auditLog)(callerUid, 'create_ehr_event', 'patients', patientId, { eventId, type: event.type });
    return { success: true, eventId };
});
