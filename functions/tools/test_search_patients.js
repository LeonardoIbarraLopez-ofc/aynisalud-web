process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9100';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8085';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'local-aynialud';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}

const agenda = require('../lib/agenda');
const handler = agenda.__testables?.searchPatientsHandler;
if (typeof handler !== 'function') {
  console.error('searchPatientsHandler not available');
  process.exit(1);
}

async function runTest(query) {
  try {
    const result = await handler({ query }, {
      auth: {
        uid: 'debug-receptionist',
        token: { role: 'receptionist', clinicId: 'clinic-1' },
      },
      rawRequest: {
        headers: {},
        body: { query },
      },
    });
    console.log(`Query "${query}" ->`, JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`Query "${query}" failed`, err);
  }
}

(async () => {
  await runTest('Paciente');
  await runTest('paciente ejemplo');
  await runTest('example@example.com');
  process.exit(0);
})();
