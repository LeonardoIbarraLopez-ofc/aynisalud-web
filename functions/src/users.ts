import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth, db, auditLog } from './utils';
import { makeHttpHandler } from './httpHelpers';

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

  type UserRole = 'admin' | 'doctor' | 'specialist' | 'receptionist' | 'patient';

  function buildSearchKeywords(values: Array<string | null | undefined>): string[] {
    const tokens = new Set<string>();
    values
      .map(value => (value ?? '').toString().toLowerCase().trim())
      .filter(value => value.length > 0)
      .forEach(value => {
        tokens.add(value);
        value.split(/\s+/).forEach(part => {
          if (part.length > 0) tokens.add(part);
        });
      });
    return Array.from(tokens).slice(0, 40);
  }

  function normalizeBoolean(value: any, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lc = value.toLowerCase();
      if (['true', '1', 'yes'].includes(lc)) return true;
      if (['false', '0', 'no'].includes(lc)) return false;
    }
    return fallback;
  }

  function coerceRole(value: any, current: UserRole): UserRole {
    const allowed: UserRole[] = ['admin', 'doctor', 'receptionist', 'specialist', 'patient'];
    if (typeof value === 'string' && allowed.includes(value as UserRole)) {
      return value as UserRole;
    }
    return current;
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
    searchKeywords: buildSearchKeywords([name, email, userRecord.uid]),
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

  const updates: Record<string, any> = { ...fields };
  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  if (fields.name || fields.email) {
    const currentSnap = await db.doc(`users/${targetUid}`).get();
    const currentData = currentSnap.exists ? currentSnap.data() : {};
    const nextName = typeof fields.name === 'string' ? fields.name : (currentData?.name || '');
    const nextEmail = typeof fields.email === 'string' ? fields.email : (currentData?.email || '');
    updates.searchKeywords = buildSearchKeywords([nextName, nextEmail, targetUid]);
  }

  await db.doc(`users/${targetUid}`).set(updates, { merge: true });
  await auditLog(caller.uid as string, 'update_user', 'users', targetUid, { fields: updates });
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

const listUsersHandler = async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  if (!caller.token || caller.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admin');
  }

  const rawSearch = typeof data?.search === 'string' ? data.search.trim().toLowerCase() : '';
  const rawRole = typeof data?.role === 'string' ? data.role.trim().toLowerCase() : '';
  const limitRaw = Number(data?.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 500) : 200;

  const allowedRoles: UserRole[] = ['admin', 'doctor', 'receptionist', 'specialist', 'patient'];
  const roleFilter = allowedRoles.includes(rawRole as UserRole) ? (rawRole as UserRole) : null;

  let query: admin.firestore.Query<admin.firestore.DocumentData> = db.collection('users');
  if (roleFilter) {
    query = query.where('role', '==', roleFilter);
  }

  const snapshot = await query.limit(limit).get();
  let users: Array<Record<string, any>> = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Record<string, any>),
  }));

  if (rawSearch) {
    users = users.filter(user => {
      const name = (user.name || '').toString().toLowerCase();
      const email = (user.email || '').toString().toLowerCase();
      const clinicId = (user.clinicId || '').toString().toLowerCase();
      const tokens: string[] = Array.isArray(user.searchKeywords)
        ? user.searchKeywords.map((token: any) => (token || '').toString().toLowerCase())
        : [];
      return (
        name.includes(rawSearch) ||
        email.includes(rawSearch) ||
        clinicId.includes(rawSearch) ||
        tokens.includes(rawSearch)
      );
    });
  }

  users.sort((a, b) => {
    const nameA = (a.name || '').toString().toLowerCase();
    const nameB = (b.name || '').toString().toLowerCase();
    if (nameA === nameB) {
      return (a.email || '').toString().localeCompare((b.email || '').toString(), 'es', { sensitivity: 'base' });
    }
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });

  return { users };
};

export const listUsers = functions.https.onCall(listUsersHandler);
export const listUsersHttp = makeHttpHandler(listUsersHandler);

const adminUpdateUserHandler = async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  if (!caller.token || caller.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admin');
  }

  const uid = typeof data?.uid === 'string' ? data.uid.trim() : '';
  const updates = data?.updates && typeof data.updates === 'object' ? data.updates : {};

  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid required');
  if (Object.keys(updates).length === 0) throw new functions.https.HttpsError('invalid-argument', 'updates required');

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const currentData = userSnap.exists ? (userSnap.data() as Record<string, any>) : {};

  const authUpdates: admin.auth.UpdateRequest = {};
  if (typeof updates.email === 'string') {
    const nextEmail = updates.email.trim();
    if (!nextEmail) throw new functions.https.HttpsError('invalid-argument', 'email cannot be empty');
    authUpdates.email = nextEmail;
  }
  if (typeof updates.password === 'string' && updates.password.trim().length > 0) {
    authUpdates.password = updates.password;
  }

  const firestoreUpdates: Record<string, any> = {};
  const allowedFirestoreFields = [
    'name',
    'email',
    'role',
    'phone',
    'clinicId',
    'avatarUrl',
    'isActive',
    'specialties',
    'languages',
    'yearsExperience',
    'bio',
    'patientProfileId',
  ];

  for (const field of allowedFirestoreFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      firestoreUpdates[field] = updates[field];
    }
  }

  if (Object.prototype.hasOwnProperty.call(firestoreUpdates, 'isActive')) {
    firestoreUpdates.isActive = normalizeBoolean(firestoreUpdates.isActive, currentData?.isActive !== false);
  }

  if (Object.prototype.hasOwnProperty.call(firestoreUpdates, 'role')) {
    firestoreUpdates.role = coerceRole(firestoreUpdates.role, currentData?.role || 'patient');
  }

  if (typeof firestoreUpdates.clinicId === 'string') {
    firestoreUpdates.clinicId = firestoreUpdates.clinicId.trim() || null;
  }

  if (typeof firestoreUpdates.phone === 'string') {
    firestoreUpdates.phone = firestoreUpdates.phone.trim();
  }

  if (firestoreUpdates.specialties) {
    firestoreUpdates.specialties = Array.isArray(firestoreUpdates.specialties)
      ? firestoreUpdates.specialties.filter(Boolean)
      : [firestoreUpdates.specialties].filter(Boolean);
  }

  if (firestoreUpdates.languages) {
    firestoreUpdates.languages = Array.isArray(firestoreUpdates.languages)
      ? firestoreUpdates.languages.filter(Boolean)
      : [firestoreUpdates.languages].filter(Boolean);
  }

  if (Object.keys(authUpdates).length > 0) {
    await admin.auth().updateUser(uid, authUpdates);
  }

  if (firestoreUpdates.email === undefined && authUpdates.email) {
    firestoreUpdates.email = authUpdates.email;
  }

  const nextName = firestoreUpdates.name !== undefined ? firestoreUpdates.name : currentData?.name || '';
  const nextEmail = firestoreUpdates.email !== undefined ? firestoreUpdates.email : currentData?.email || '';
  if (firestoreUpdates.name !== undefined || firestoreUpdates.email !== undefined) {
    firestoreUpdates.searchKeywords = buildSearchKeywords([nextName, nextEmail, uid]);
  }

  firestoreUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  if (Object.keys(firestoreUpdates).length > 0) {
    await userRef.set(firestoreUpdates, { merge: true });
  }

  if (firestoreUpdates.role !== undefined || firestoreUpdates.clinicId !== undefined) {
    const userRecord = await admin.auth().getUser(uid);
    const currentClaims = userRecord.customClaims || {};
    const newClaims = { ...currentClaims } as Record<string, any>;
    if (firestoreUpdates.role !== undefined) {
      newClaims.role = firestoreUpdates.role;
    }
    if (firestoreUpdates.clinicId !== undefined) {
      newClaims.clinicId = firestoreUpdates.clinicId || null;
    }
    await admin.auth().setCustomUserClaims(uid, newClaims);
  }

  await auditLog(caller.uid as string, 'admin_update_user', 'users', uid, {
    updates: firestoreUpdates,
    authUpdates: Object.keys(authUpdates).length > 0,
  });

  return { success: true };
};

export const adminUpdateUser = functions.https.onCall(adminUpdateUserHandler);
export const adminUpdateUserHttp = makeHttpHandler(adminUpdateUserHandler);

const deleteUserAdminHandler = async (data: any, context: any) => {
  const caller = await requireAuth(context, data);
  if (!caller.token || caller.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admin');
  }

  const uid = typeof data?.uid === 'string' ? data.uid.trim() : '';
  if (!uid) throw new functions.https.HttpsError('invalid-argument', 'uid required');

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const payload = userSnap.exists ? (userSnap.data() as Record<string, any>) : null;

  if (userSnap.exists) {
    await userRef.delete();
  }

  const patientProfileId = payload?.patientProfileId;
  if (patientProfileId) {
    const patientRef = db.doc(`patients/${patientProfileId}`);
    await patientRef.set({ authUid: admin.firestore.FieldValue.delete() }, { merge: true }).catch(() => undefined);
  }

  try {
    await admin.auth().deleteUser(uid);
  } catch (err: any) {
    if (!err || err.code !== 'auth/user-not-found') {
      throw err;
    }
  }

  await auditLog(caller.uid as string, 'delete_user', 'users', uid, {
    hadProfile: !!patientProfileId,
  });

  return { success: true };
};

export const deleteUserAdmin = functions.https.onCall(deleteUserAdminHandler);
export const deleteUserAdminHttp = makeHttpHandler(deleteUserAdminHandler);

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
