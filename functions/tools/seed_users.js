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
const { randomUUID } = require('node:crypto');

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
          ...(role === 'patient' ? { patientProfileId: u.uid } : {}),
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
      if (snap.exists) {
        const updates = { updatedAt: new Date(), clinicId, role };
        if (role === 'patient' && snap.data()?.patientProfileId !== u.uid) {
          updates.patientProfileId = u.uid;
        }
        await docRef.set(updates, { merge: true });
      }
    } catch (e) {
      console.warn('Could not ensure users doc for', email, e && e.message ? e.message : e);
    }

    if (role === 'patient') {
      await ensurePatientProfile(u, name, clinicId);
      try {
        const db = admin.firestore();
        await db.doc(`users/${u.uid}`).set({ patientProfileId: u.uid, updatedAt: new Date() }, { merge: true });
      } catch (err) {
        console.warn('Failed to link patientProfileId on user doc for', email, err && err.message ? err.message : err);
      }
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
      ...(role === 'patient' ? { patientProfileId: u.uid } : {}),
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

async function seedPatientEhrTimeline(patientRecord, doctorRecord) {
  const db = admin.firestore();
  const patientId = patientRecord.uid;
  const doctorId = doctorRecord.uid;

  const timelineCollection = db.collection(`patients/${patientId}/timeline`);
  const existing = await timelineCollection.limit(1).get();
  if (!existing.empty) {
    console.log('Timeline already present for patient', patientId);
    return;
  }

  const doctorSnap = await db.doc(`users/${doctorId}`).get();
  const patientSnap = await db.doc(`patients/${patientId}`).get();
  const doctorName = doctorSnap.exists ? (doctorSnap.data().name || 'Profesional de salud') : 'Profesional de salud';
  const clinicId = patientSnap.exists ? patientSnap.data().clinicId || null : null;

  const fieldValue = admin.firestore.FieldValue;
  const serverTimestamp = typeof fieldValue?.serverTimestamp === 'function' ? fieldValue.serverTimestamp() : new Date();

  const now = new Date();
  const events = [
    {
      type: 'consultation_note',
      title: 'Consulta de control crónico',
      summary: 'Revisión de hipertensión y ajuste de tratamiento.',
      performedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      tags: ['control', 'hipertension'],
      soapNote: {
        subjective: 'Paciente refiere cefalea ocasional por la noche.',
        objective: 'TA 138/86 mmHg, FC 78 lpm. Sin edemas periféricos.',
        assessment: 'Hipertensión arterial en seguimiento, control aceptable.',
        plan: 'Ajustar dosis de losartán a 50mg diarios. Control en 4 semanas.',
      },
      prescriptions: [
        { medicationName: 'Losartán', dosage: '50mg', frequency: '1 tableta diaria', duration: '30 días' },
      ],
      labOrders: [
        { testName: 'Perfil lipídico', details: 'Ayuno de 12 horas.' },
      ],
    },
    {
      type: 'lab_result',
      title: 'Perfil lipídico',
      summary: 'LDL 110 mg/dL, HDL 48 mg/dL, Triglicéridos 150 mg/dL.',
      performedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      tags: ['laboratorio'],
      details: 'Resultados dentro de rango controlado. Recomendar mantener dieta baja en sodio.',
    },
    {
      type: 'prescription',
      title: 'Renovación de medicación antihipertensiva',
      summary: 'Se renueva tratamiento antihipertensivo.',
      performedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      prescriptions: [
        { medicationName: 'Losartán', dosage: '50mg', frequency: '1 tableta diaria', duration: '90 días' },
        { medicationName: 'Hidroclorotiazida', dosage: '25mg', frequency: '1 tableta cada mañana', duration: '60 días' },
      ],
      tags: ['medicación'],
    },
    {
      type: 'vital_sign',
      title: 'Control de signos vitales',
      summary: 'Signos vitales estables durante visita de seguimiento.',
      performedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      vitals: [
        { name: 'Presión arterial', value: '125/82', unit: 'mmHg' },
        { name: 'Frecuencia cardíaca', value: '76', unit: 'lpm' },
        { name: 'Peso', value: '78', unit: 'kg' },
      ],
      tags: ['signos'],
    },
  ];

  const batch = db.batch();

  for (const event of events) {
    const eventId = randomUUID();
    const timelineRef = timelineCollection.doc(eventId);
    const performedAt = admin.firestore.Timestamp.fromDate(event.performedAt);
    const payload = {
      type: event.type,
      title: event.title,
      summary: event.summary,
      details: event.details || null,
      tags: event.tags || [],
      appointmentId: null,
      status: 'final',
      performedAt,
      soapNote: event.soapNote || null,
      prescriptions: event.prescriptions || [],
      labOrders: event.labOrders || [],
      vitals: event.vitals || [],
      actor: {
        uid: doctorId,
        name: doctorName,
        role: 'doctor',
      },
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    };

    batch.set(timelineRef, payload);

    const searchableRef = db.collection('ehrEvents_searchable').doc(eventId);
    batch.set(searchableRef, {
      eventId,
      patientId,
      clinicId,
      date: performedAt,
      type: event.type,
      code: null,
      actorDoctorId: doctorId,
      createdAt: serverTimestamp,
      title: event.title,
      summary: event.summary,
      tags: event.tags || [],
    });
  }

  await batch.commit();
  console.log('Seeded EHR timeline events for patient', patientId);
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

async function upsertProviderProfile(userId, role, profileData) {
  const db = admin.firestore();
  const collection = role === 'specialist' ? 'specialistProfiles' : 'doctorProfiles';
  const docRef = db.doc(`${collection}/${userId}`);
  const snapshot = await docRef.get();
  const payload = {
    id: userId,
    professionalLicense: profileData.professionalLicense || '',
    specialties: Array.isArray(profileData.specialties) ? profileData.specialties : [],
    languages: Array.isArray(profileData.languages) ? profileData.languages : [],
    yearsExperience: profileData.yearsExperience || 0,
    bio: profileData.bio || '',
    updatedAt: new Date(),
    updatedBy: 'system-seed',
  };
  if (snapshot.exists) {
    await docRef.set(payload, { merge: true });
    console.log(`Updated ${collection}/ doc for`, userId);
  } else {
    await docRef.set(payload);
    console.log(`Created ${collection}/ doc for`, userId);
  }
}

function buildWeeklyAvailabilityTemplate(templateOverrides = {}) {
  const base = {
    sunday: [],
    monday: [
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ],
    tuesday: [
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ],
    wednesday: [
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ],
    thursday: [
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ],
    friday: [
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '17:00' },
    ],
    saturday: [
      { start: '09:00', end: '13:00' },
    ],
  };
  return { ...base, ...templateOverrides };
}

async function upsertProviderSchedule(userId, role, options = {}) {
  const db = admin.firestore();
  const docRef = db.doc(`providerSchedules/${userId}`);
  const timestampField = admin.firestore.FieldValue && admin.firestore.FieldValue.serverTimestamp
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();

  const schedulePayload = {
    providerId: userId,
    timezone: options.timezone || 'America/Lima',
    slotDurationMinutes: options.slotDurationMinutes || 30,
    weeklyAvailability: buildWeeklyAvailabilityTemplate(options.weeklyAvailabilityOverrides),
    overrides: options.overrides || {},
    blockedDates: options.blockedDates || [],
    updatedAt: timestampField,
    updatedBy: { uid: 'system-seed', role: 'admin', source: role },
  };

  await docRef.set(schedulePayload, { merge: true });
  console.log('Provisioned schedule for', userId);
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
  const specialist = await createUserIfMissing('specialist@local.test', 'specialist123', 'Especialista Ejemplo', 'specialist', 'clinic-1');
  await createUserIfMissing('leo.ibarralopez@gmail.com', 'admin123', 'Admin Ejemplo', 'admin', null);
  await upsertProviderProfile(doctor.uid, 'doctor', {
    professionalLicense: 'CMP 123456',
    specialties: ['Medicina General'],
    languages: ['Español'],
    yearsExperience: 8,
    bio: 'Médico general con enfoque en atención primaria, seguimiento de pacientes crónicos y prevención.',
  });
  await upsertProviderSchedule(doctor.uid, 'doctor', {
    slotDurationMinutes: 30,
  });
  await upsertProviderProfile(specialist.uid, 'specialist', {
    professionalLicense: 'RNE 987654',
    specialties: ['Cardiología', 'Electrocardiografía'],
    languages: ['Español', 'Inglés'],
    yearsExperience: 12,
    bio: 'Cardiólogo con experiencia en diagnóstico no invasivo y programas de rehabilitación cardiovascular.',
  });
  await upsertProviderSchedule(specialist.uid, 'specialist', {
    slotDurationMinutes: 45,
    weeklyAvailabilityOverrides: {
      monday: [
        { start: '10:00', end: '13:00' },
        { start: '15:00', end: '19:00' },
      ],
      wednesday: [
        { start: '10:00', end: '16:00' },
      ],
      friday: [
        { start: '09:00', end: '12:00' },
        { start: '14:00', end: '17:00' },
      ],
      saturday: [
        { start: '09:00', end: '12:00' },
      ],
    },
  });
  await ensureCheckoutDemo(doctor, patient);
  await seedPatientEhrTimeline(patient, doctor);
  console.log('Seeding complete');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
