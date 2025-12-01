/**
 * Seed utility to create example users (doctor, receptionist, patient) in the Auth emulator
 * and corresponding `users/{uid}` documents. Run from the functions folder:
 *
 * node tools/seed_users.js
 *
 * Make sure the emulators (auth, firestore, functions) are running.
 */

// Ensure emulator env vars are set BEFORE initializing admin so the SDK talks to the local emulators.
// Defaults updated to match project's firebase.json which uses alternate ports to avoid local conflicts.
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9100';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8085';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'local-aynialud';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });

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

async function ensurePatientProfile(userRecord, name, clinicId) {
  const db = admin.firestore();
  const patientId = userRecord.uid;
  const patientRef = db.doc(`patients/${patientId}`);
  const patientSnap = await patientRef.get();

  const nameParts = (name || userRecord.displayName || '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.length > 0 ? nameParts[0] : 'Paciente';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (nameParts.length === 1 ? nameParts[0] : 'Demo');

  if (!patientSnap.exists) {
    const timestamp = new Date();
    const patientDoc = {
      firstName,
      lastName,
      dob: '',
      gender: 'other',
      idNumber: '',
      contactInfo: {
        email: userRecord.email || '',
        phone: '',
        address: '',
      },
      insuranceInfo: [],
      allergies: [],
      chronicConditions: [],
      avatarUrl: '',
      authUid: userRecord.uid,
      clinicId: clinicId || null,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: { uid: 'system-seed', role: 'admin' },
      searchKeywords: buildSearchKeywords([firstName, lastName, userRecord.email]),
    };
    await patientRef.set(patientDoc);
    console.log('Created patients/ doc for', userRecord.email, patientId);
    return;
  }

  const updates = {};
  let needsUpdate = false;
  const existing = patientSnap.data() || {};
  if (!existing.authUid) {
    updates.authUid = userRecord.uid;
    needsUpdate = true;
  }
  if (!existing.searchKeywords || !Array.isArray(existing.searchKeywords) || existing.searchKeywords.length === 0) {
    updates.searchKeywords = buildSearchKeywords([existing.firstName, existing.lastName, userRecord.email]);
    needsUpdate = true;
  }
  if (needsUpdate) {
    updates.updatedAt = new Date();
    await patientRef.set(updates, { merge: true });
    console.log('Updated existing patients/ doc for', userRecord.email, patientId);
  }
}

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

    if (role === 'patient') {
      await ensurePatientProfile(u, name, clinicId);
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
    if (role === 'patient') {
      await ensurePatientProfile(u, name, clinicId);
    }
    return u;
  }
}

async function ensureAppointmentType(id, data) {
  const db = admin.firestore();
  const ref = db.doc(`appointmentTypes/${id}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ ...data, id });
    console.log('Created appointment type', id);
  }
}

function buildPatientSnapshot(patientDoc, patientId) {
  return {
    id: patientId,
    firstName: patientDoc.firstName || 'Paciente',
    lastName: patientDoc.lastName || 'Ejemplo',
    dob: patientDoc.dob || '',
    gender: ['male', 'female', 'other'].includes(patientDoc.gender) ? patientDoc.gender : 'other',
    idNumber: patientDoc.idNumber || '',
    contactInfo: {
      email: patientDoc.contactInfo?.email || '',
      phone: patientDoc.contactInfo?.phone || '',
      address: patientDoc.contactInfo?.address || '',
    },
    insuranceInfo: Array.isArray(patientDoc.insuranceInfo) ? patientDoc.insuranceInfo : [],
    allergies: Array.isArray(patientDoc.allergies) ? patientDoc.allergies : [],
    chronicConditions: Array.isArray(patientDoc.chronicConditions) ? patientDoc.chronicConditions : [],
    avatarUrl: patientDoc.avatarUrl || '',
    clinicId: patientDoc.clinicId || null,
  };
}

function buildDoctorSnapshot(doctorDoc, doctorId) {
  return {
    id: doctorId,
    name: doctorDoc.name || 'Dr. Ejemplo',
    email: doctorDoc.email || '',
    role: doctorDoc.role || 'doctor',
    avatarUrl: doctorDoc.avatarUrl || '',
    phone: doctorDoc.phone || '',
    isActive: doctorDoc.isActive !== false,
    clinicId: doctorDoc.clinicId || null,
  };
}

async function ensureCheckoutDemo(doctorRecord, patientRecord) {
  const db = admin.firestore();

  await ensureAppointmentType('consulta-general', {
    name: 'Consulta General',
    durationMinutes: 30,
    price: 150,
    description: 'Chequeo de rutina.',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const patientSnap = await db.doc(`patients/${patientRecord.uid}`).get();
  if (!patientSnap.exists) {
    console.warn('Patient profile missing for demo checkout seed');
    return;
  }

  const doctorSnap = await db.doc(`users/${doctorRecord.uid}`).get();
  if (!doctorSnap.exists) {
    console.warn('Doctor profile missing for demo checkout seed');
    return;
  }

  const patientSnapshot = buildPatientSnapshot(patientSnap.data(), patientRecord.uid);
  const doctorSnapshot = buildDoctorSnapshot(doctorSnap.data(), doctorRecord.uid);
  const typeSnapshot = {
    id: 'consulta-general',
    name: 'Consulta General',
    durationMinutes: 30,
    price: 150,
    description: 'Chequeo de rutina.',
  };

  const fieldValue = admin.firestore && admin.firestore.FieldValue ? admin.firestore.FieldValue : null;
  const serverTimestamp = fieldValue && typeof fieldValue.serverTimestamp === 'function' ? fieldValue.serverTimestamp : null;
  const nowValue = serverTimestamp ? serverTimestamp() : new Date();

  const start = new Date();
  start.setHours(8, 30, 0, 0);
  const end = new Date(start.getTime() + typeSnapshot.durationMinutes * 60000);

  const appointmentRef = db.doc('appointments/appointment-checkout-demo');
  await appointmentRef.set({
    patientId: patientRecord.uid,
    doctorId: doctorRecord.uid,
    typeId: typeSnapshot.id,
    startTime: admin.firestore.Timestamp.fromDate(start),
    endTime: admin.firestore.Timestamp.fromDate(end),
    status: 'attended_pending_payment',
    checkinTime: admin.firestore.Timestamp.fromDate(new Date(start.getTime() - 5 * 60000)),
    clinicId: doctorSnapshot.clinicId || 'clinic-1',
    notes: 'Paciente listo para check-out.',
    associatedInvoiceId: 'inv-checkout-demo',
    createdAt: nowValue,
    updatedAt: nowValue,
    createdBy: { uid: 'system-seed', role: 'admin' },
    patientSnapshot,
    doctorSnapshot,
    typeSnapshot,
  }, { merge: true });
  console.log('Seeded demo appointment for checkout');

  const invoiceRef = db.doc('invoices/inv-checkout-demo');
  await invoiceRef.set({
    patientId: patientRecord.uid,
    date: start.toISOString(),
    dueDate: new Date().toISOString(),
    status: 'draft',
    items: [
      {
        description: typeSnapshot.name,
        quantity: 1,
        unitPrice: typeSnapshot.price,
        total: typeSnapshot.price,
      },
    ],
    subtotal: typeSnapshot.price,
    tax: 0,
    total: typeSnapshot.price,
    paymentDetails: [],
    lastPaymentAt: null,
    clinicId: doctorSnapshot.clinicId || 'clinic-1',
    createdAt: nowValue,
    updatedAt: nowValue,
  }, { merge: true });
  console.log('Seeded demo invoice inv-checkout-demo');
}

async function main() {
  const doctor = await createUserIfMissing('doctor@local.test', 'doctor123', 'Dr. Ejemplo', 'doctor', 'clinic-1');
  await createUserIfMissing('reception@local.test', 'recep123', 'Recepcion', 'receptionist', 'clinic-1');
  const patient = await createUserIfMissing('patient@local.test', 'patient123', 'Paciente Ejemplo', 'patient', 'clinic-1');
  // add the remaining roles
  await createUserIfMissing('specialist@local.test', 'specialist123', 'Especialista Ejemplo', 'specialist', 'clinic-1');
  await createUserIfMissing('leo.ibarralopez@gmail.com', 'admin123', 'Admin Ejemplo', 'admin', null);
  await ensureCheckoutDemo(doctor, patient);
  console.log('Seeding complete');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
