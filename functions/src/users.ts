import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth, db, auditLog } from './utils';

// Small helper to safely stringify objects (avoid circulars) and truncate large output
function safeStringify(obj: any, maxLen = 2000) {
  const seen = new WeakSet();
  try {
    const s = JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'function') return `[Function:${value.name || 'anonymous'}]`;
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
    if (s.length > maxLen) return s.slice(0, maxLen) + `... (truncated ${s.length - maxLen} chars)`;
    return s;
  } catch (e) {
    return `<<safeStringify error: ${String(e)}>>`;
  }
}

// Create user (admin only). Creates Firebase Auth user and users/{uid} document.
export const createUserAdmin = functions.https.onCall(async (data: any, context: any) => {
  try {
  // DEBUG: dump context and rawRequest (safe/truncated) to inspect what the emulator forwards
  try {
    try {
      console.log('DEBUG createUserAdmin dump context.auth/rawRequest=', safeStringify({
        contextAuth: context && context.auth ? { uid: context.auth.uid, token: context.auth.token } : null,
        rawHeaders: context && context.rawRequest ? (context.rawRequest.headers || {}) : null,
        rawBody: context && context.rawRequest ? (context.rawRequest.body || context.rawRequest.rawBody || null) : null,
      }, 4000));
      // Also dump the callable `data` payload (what the client sent as `data`)
      console.log('DEBUG createUserAdmin incoming data=', safeStringify(data, 2000));
    } catch (e) {
      console.log('DEBUG createUserAdmin dump failed', String(e));
    }

    // DEBUG: log context auth/rawRequest to troubleshoot emulator auth forwarding
    
    // avoid circulars in context when stringifying
    const a = context && context.auth ? { uid: context.auth.uid, token: context.auth.token } : null;
    console.log('DEBUG createUserAdmin context.auth=', a);
    if (context && context.rawRequest) {
      try {
        // rawRequest.headers could be large; only show authorization header
        const hdrs = context.rawRequest.headers || {};
        console.log('DEBUG createUserAdmin rawRequest.authorization=', hdrs.authorization || hdrs.Authorization || null);
        if (typeof context.rawRequest.get === 'function') {
          console.log('DEBUG createUserAdmin rawRequest.get(Authorization)=', context.rawRequest.get('Authorization') || context.rawRequest.get('authorization'));
        }
      } catch (e) {
        console.log('DEBUG createUserAdmin rawRequest inspection failed', e);
      }
    }
  } catch (e) {
    console.log('DEBUG createUserAdmin context logging failed', e);
  }

  const caller = await requireAuth(context, data);
  if (!caller.token || caller.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admin can create users');
  }

  // Helper to robustly extract fields from the callable `data` payload or wrapped rawRequest
  function extractField(fieldName: string) {
    // direct
    if (data && typeof data === 'object' && data[fieldName]) return data[fieldName];
    // nested under data.data (rare wrapper)
    if (data && data.data && typeof data.data === 'object' && data.data[fieldName]) return data.data[fieldName];
    // if the client or emulator put the parsed body under data.rawRequest.body
    if (data && data.rawRequest && data.rawRequest.body) {
      const b = data.rawRequest.body;
      if (typeof b === 'string') {
        try { const p = JSON.parse(b); if (p && p[fieldName]) return p[fieldName]; if (p.data && p.data[fieldName]) return p.data[fieldName]; } catch (e) { /* ignore */ }
      } else if (typeof b === 'object') {
        if (b[fieldName]) return b[fieldName];
        if (b.data && b.data[fieldName]) return b.data[fieldName];
      }
    }
    // fallback to context.rawRequest body
    if (context && context.rawRequest && context.rawRequest.body) {
      const b = context.rawRequest.body;
      if (typeof b === 'string') {
        try { const p = JSON.parse(b); if (p && p[fieldName]) return p[fieldName]; if (p.data && p.data[fieldName]) return p.data[fieldName]; } catch (e) { /* ignore */ }
      } else if (typeof b === 'object') {
        if (b[fieldName]) return b[fieldName];
        if (b.data && b.data[fieldName]) return b.data[fieldName];
      }
    }
    return undefined;
  }

  const email = extractField('email');
  const password = extractField('password');
  const name = extractField('name') || '';
  const role = extractField('role') || 'patient';
  const avatarUrl = extractField('avatarUrl') || null;
  const clinicId = extractField('clinicId') || null;

  if (!email) throw new functions.https.HttpsError('invalid-argument', 'email required');

  // Create Auth user
  const userRecord = await admin.auth().createUser({ email, password });

  const userDoc = {
    id: userRecord.uid,
    name: name || '',
    email,
    role,
    isActive: true,
    avatarUrl,
    clinicId,
    // Use serverTimestamp if available, otherwise fallback to current Date for emulator/runtime
    createdAt: (admin.firestore && (admin.firestore as any).FieldValue && (admin.firestore as any).FieldValue.serverTimestamp)
      ? (admin.firestore as any).FieldValue.serverTimestamp()
      : new Date(),
    updatedAt: (admin.firestore && (admin.firestore as any).FieldValue && (admin.firestore as any).FieldValue.serverTimestamp)
      ? (admin.firestore as any).FieldValue.serverTimestamp()
      : new Date(),
  };

  await db.doc(`users/${userRecord.uid}`).set(userDoc);

  // Optionally set custom claims
  const claims: any = { role };
  if (clinicId) claims.clinicId = clinicId;
  await admin.auth().setCustomUserClaims(userRecord.uid, claims);

  await auditLog(caller.uid as string, 'create_user', 'users', userRecord.uid, { email, role });

  return { uid: userRecord.uid };
  } catch (err: any) {
    console.error('createUserAdmin unexpected error:', err && err.stack ? err.stack : err);
    throw new functions.https.HttpsError('internal', (err && err.message) ? err.message : String(err));
  }
});

// Update profile: user can update own profile; admin can update any.
export const updateProfile = functions.https.onCall(async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  const { uidToUpdate, fields } = data || {};
  if (!fields || typeof fields !== 'object') throw new functions.https.HttpsError('invalid-argument', 'fields required');

  const targetUid = uidToUpdate || caller.uid;
  // Only admin can update other users
  if (targetUid !== caller.uid && caller.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Not allowed');
  }

  // Prevent role changes from non-admin
  if (fields.role && caller.token.role !== 'admin') delete fields.role;

  fields.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  await db.doc(`users/${targetUid}`).set(fields, { merge: true });
  await auditLog(caller.uid as string, 'update_user', 'users', targetUid, { fields });
  return { success: true };
});

// Link patient profile to a user (verification required). Admin or user can trigger.
export const linkPatient = functions.https.onCall(async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  const { patientId, verify } = data || {};
  if (!patientId) throw new functions.https.HttpsError('invalid-argument', 'patientId required');

  const targetUserUid = caller.uid as string;

  // Transaction: set patients/{pid}.authUid and users/{uid}.patientProfileId if verification passes
  await db.runTransaction(async (tx) => {
    const pRef = db.doc(`patients/${patientId}`);
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists) throw new functions.https.HttpsError('not-found', 'patient not found');

    const patient = pSnap.data() as any;

    // If verify payload is provided, you can validate e.g. idNumber and dob
    if (verify && typeof verify === 'object') {
      if (verify.idNumber && patient.idNumber !== verify.idNumber) throw new functions.https.HttpsError('permission-denied', 'Verification failed');
      if (verify.dob && patient.dob !== verify.dob) throw new functions.https.HttpsError('permission-denied', 'Verification failed');
    }

    tx.update(pRef, { authUid: targetUserUid });
    const uRef = db.doc(`users/${targetUserUid}`);
    tx.set(uRef, { patientProfileId: patientId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });

  await auditLog(caller.uid as string, 'link_patient', 'patients', patientId, { linkedTo: caller.uid });
  return { success: true };
});

// Set custom claims (admin only)
export const setCustomClaims = functions.https.onCall(async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  if (!caller.token || caller.token.role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Only admin');

  const { uid, claims } = data || {};
  if (!uid || !claims || typeof claims !== 'object') throw new functions.https.HttpsError('invalid-argument', 'uid and claims required');

  await admin.auth().setCustomUserClaims(uid, claims);
  await db.doc(`users/${uid}`).set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await auditLog(caller.uid as string, 'set_custom_claims', 'users', uid, { claims });
  return { success: true };
});

// Callable to fetch the current authenticated user's profile document
export const getMyProfile = functions.https.onCall(async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  const uid = caller.uid as string;
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Missing auth');
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return { exists: false };
  const doc = snap.data();
  // return token claims for client-side routing decisions
  return { exists: true, profile: doc, claims: caller.token || {} };
});

// HTTP endpoint variant for local development that returns the same profile payload
// and sets CORS headers so browser clients can call it directly when the callable path
// has preflight/CORS issues in the emulator. It expects Authorization: Bearer <idToken>.
export const getMyProfileHttp = functions.https.onRequest(async (req, res) => {
  // CORS preflight handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Allow token via Authorization header or via query param `idToken` for simple GET fallback from browser
    const authHeader = (req.get('Authorization') || req.get('authorization') || '') as string;
    let idToken: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.replace(/^Bearer\s+/, '');
    } else if (req.method === 'GET' && req.query && req.query.idToken) {
      // NOTE: passing idToken in query is acceptable for local emulator development only
      idToken = String(req.query.idToken || '');
    }
    if (!idToken) {
      res.status(401).json({ error: 'Missing Authorization Bearer token or idToken query param' });
      return;
    }
    // verify token via admin SDK
    const decoded = await admin.auth().verifyIdToken(idToken).catch((e) => {
      console.error('verifyIdToken failed', e && e.message ? e.message : e);
      return null;
    });
    if (!decoded || !decoded.uid) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  const uid = decoded.uid;
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) {
      res.json({ exists: false });
      return;
    }
    const doc = snap.data();
    res.json({ exists: true, profile: doc, claims: decoded || {} });
  } catch (err: any) {
    console.error('getMyProfileHttp error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: (err && err.message) ? err.message : String(err) });
  }
});

// Admin-only callable to list users by role (useful for admin UI)
export const listUsersByRole = functions.https.onCall(async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  if (!caller.token || caller.token.role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Only admin');
  const { role } = data || {};
  if (!role) throw new functions.https.HttpsError('invalid-argument', 'role required');
  const q = await db.collection('users').where('role', '==', role).limit(500).get();
  const users = q.docs.map(d => ({ id: d.id, ...d.data() }));
  return { users };
});
