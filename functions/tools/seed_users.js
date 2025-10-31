/**
 * Seed utility to create example users (doctor, receptionist, patient) in the Auth emulator
 * and corresponding `users/{uid}` documents. Run from the functions folder:
 *
 * node tools/seed_users.js
 *
 * Make sure the emulators (auth, firestore, functions) are running.
 */

// Ensure emulator env vars are set BEFORE initializing admin so the SDK talks to the local emulators.
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'local-aynialud';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });

async function createUserIfMissing(email, password, name, role, clinicId = null) {
  try {
    const u = await admin.auth().getUserByEmail(email);
    console.log('Found existing user', email, u.uid);
    // ensure custom claims are set
    try {
      const existingClaims = (await admin.auth().getUser(u.uid)).customClaims || {};
      if (existingClaims.role !== role || existingClaims.clinicId !== clinicId) {
        await admin.auth().setCustomUserClaims(u.uid, { role, clinicId });
        console.log('Updated custom claims for', email);
      }
    } catch (e) {
      console.warn('Could not inspect/set custom claims for', email, e && e.message ? e.message : e);
    }
    // ensure users/{uid} doc exists
    try {
      const db = admin.firestore();
      const docRef = db.doc(`users/${u.uid}`);
      const snap = await docRef.get();
      if (!snap.exists) {
        const userDoc = {
          id: u.uid,
          email,
          name,
          role,
          isActive: true,
          clinicId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await docRef.set(userDoc);
        console.log('Created missing users/ doc for', email, u.uid);
        // audit
        try {
          await db.collection('auditLogs').add({ actorId: 'system-seed', action: 'seed_create_user', targetCollection: 'users', targetId: u.uid, details: { email, role }, timestamp: admin.firestore.FieldValue.serverTimestamp ? admin.firestore.FieldValue.serverTimestamp() : new Date() });
        } catch (e) {
          console.warn('Could not write audit log for', email, e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      console.warn('Could not ensure users doc for', email, e && e.message ? e.message : e);
    }

    return u;
  } catch (e) {
    const u = await admin.auth().createUser({ email, password });
    await admin.auth().setCustomUserClaims(u.uid, { role, clinicId });
    const userDoc = {
      id: u.uid,
      email,
      name,
      role,
      isActive: true,
      clinicId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = admin.firestore();
    await db.doc(`users/${u.uid}`).set(userDoc);
    try {
      await db.collection('auditLogs').add({ actorId: 'system-seed', action: 'seed_create_user', targetCollection: 'users', targetId: u.uid, details: { email, role }, timestamp: admin.firestore.FieldValue.serverTimestamp ? admin.firestore.FieldValue.serverTimestamp() : new Date() });
    } catch (e) {
      console.warn('Could not write audit log for created user', email, e && e.message ? e.message : e);
    }
    console.log('Created user', email, u.uid);
    return u;
  }
}

async function main() {
  await createUserIfMissing('doctor@local.test', 'doctor123', 'Dr. Ejemplo', 'doctor', 'clinic-1');
  await createUserIfMissing('reception@local.test', 'recep123', 'Recepcion', 'receptionist', 'clinic-1');
  await createUserIfMissing('patient@local.test', 'patient123', 'Paciente Ejemplo', 'patient', 'clinic-1');
  // add the remaining roles
  await createUserIfMissing('specialist@local.test', 'specialist123', 'Especialista Ejemplo', 'specialist', 'clinic-1');
  await createUserIfMissing('admin@local.test', 'admin123', 'Admin Ejemplo', 'admin', null);
  console.log('Seeding complete');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
