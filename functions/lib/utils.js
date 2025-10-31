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
exports.db = void 0;
exports.requireAuth = requireAuth;
exports.loadPatient = loadPatient;
exports.isAdmin = isAdmin;
exports.isClinician = isClinician;
exports.auditLog = auditLog;
exports.createAuthUser = createAuthUser;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// Ensure the admin SDK is initialized as early as possible. Many modules
// import `utils` (and then call admin services) at module-evaluation time
// when the Functions emulator analyzes the code. Initializing here ensures
// a default app exists for any consumer.
if (!admin.apps || admin.apps.length === 0) {
    admin.initializeApp();
}
exports.db = admin.firestore();
async function requireAuth(context, data) {
    // Preferred: context.auth populated by the callable wrapper
    if (context && context.auth && context.auth.uid) {
        return { uid: context.auth.uid, token: context.auth.token };
    }
    // Fallback: try to extract Authorization header from rawRequest (emulator/runtime differences)
    // Some runtimes attach the raw HTTP request to `context.rawRequest`; other wrappers
    // (observed in the emulator) may place it under the callable `data` argument as
    // `data.rawRequest`. Prefer context.rawRequest but fall back to data.rawRequest.
    let raw = context && context.rawRequest ? context.rawRequest : null;
    if (!raw && data && data.rawRequest)
        raw = data.rawRequest;
    const authHeader = raw && raw.headers ? (raw.headers.authorization || raw.headers.Authorization) : null;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        const idToken = authHeader.split(' ')[1];
        try {
            // verifyIdToken is async; await it and return decoded token
            const decoded = await admin.auth().verifyIdToken(idToken);
            return { uid: decoded.uid, token: decoded };
        }
        catch (e) {
            // token invalid or verification failed
            throw new functions.https.HttpsError('unauthenticated', 'Invalid auth token');
        }
    }
    // Additional fallback: some clients or proxy layers may put the token inside the request body
    // or in the callable `data` payload passed as the first parameter to onCall functions.
    // Check common locations: body.token, body.idToken, body.data.token, body.data.idToken, body.__session, etc.
    try {
        const body = raw && raw.body ? raw.body : null;
        // Determine the callable payload. If `data` looks like a real payload (not a wrapper
        // containing rawRequest), prefer it. Otherwise fall back to parsed body.data.
        const payload = (data && typeof data === 'object' && !data.rawRequest) ? data : (body && body.data) || null;
        const candidates = [];
        if (body) {
            if (typeof body === 'string') {
                // try to parse JSON string
                try {
                    const parsed = JSON.parse(body);
                    Object.assign(body, parsed);
                }
                catch (e) { /* ignore */ }
            }
            if (body.token && typeof body.token === 'string')
                candidates.push(body.token);
            if (body.idToken && typeof body.idToken === 'string')
                candidates.push(body.idToken);
            if (body.__session && body.__session.token && typeof body.__session.token === 'string')
                candidates.push(body.__session.token);
            if (body.auth && body.auth.token && typeof body.auth.token === 'string')
                candidates.push(body.auth.token);
            if (body.data && typeof body.data === 'object') {
                if (body.data.token && typeof body.data.token === 'string')
                    candidates.push(body.data.token);
                if (body.data.idToken && typeof body.data.idToken === 'string')
                    candidates.push(body.data.idToken);
                // allow payload to carry an explicit __idToken for testing flows
                if (body.data.__idToken && typeof body.data.__idToken === 'string')
                    candidates.push(body.data.__idToken);
            }
        }
        // check the `data` argument (callable payload) first when present
        if (payload && typeof payload === 'object') {
            if (payload.__idToken && typeof payload.__idToken === 'string')
                candidates.unshift(payload.__idToken);
            if (payload.idToken && typeof payload.idToken === 'string')
                candidates.unshift(payload.idToken);
            if (payload.token && typeof payload.token === 'string')
                candidates.unshift(payload.token);
        }
        for (const t of candidates) {
            if (t && typeof t === 'string' && t.length > 100) {
                try {
                    const decoded = await admin.auth().verifyIdToken(t);
                    return { uid: decoded.uid, token: decoded };
                }
                catch (e) {
                    // ignore and try next candidate
                }
            }
        }
    }
    catch (e) {
        // ignore body parsing/verifying errors and fall through to unauthenticated
    }
    throw new functions.https.HttpsError('unauthenticated', 'Missing auth context');
}
async function loadPatient(pid) {
    const snap = await exports.db.doc(`patients/${pid}`).get();
    if (!snap.exists)
        throw new Error('patient-not-found');
    return snap.data();
}
function isAdmin(token) {
    return token && token.role === 'admin';
}
function isClinician(token) {
    return token && (token.role === 'doctor' || token.role === 'specialist' || token.role === 'receptionist');
}
async function auditLog(actorUid, action, targetCollection, targetId, details = {}) {
    const entry = {
        actorId: actorUid,
        action,
        targetCollection,
        targetId,
        details,
        timestamp: (admin.firestore && admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp)
            ? admin.firestore.FieldValue.serverTimestamp()
            : new Date(),
    };
    await exports.db.collection('auditLogs').add(entry);
}
async function createAuthUser(email, password) {
    const u = await admin.auth().createUser({ email, password });
    return u;
}
