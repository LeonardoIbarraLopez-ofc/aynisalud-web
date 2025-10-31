/**
 * Small helper to exercise the Auth + Functions emulator end-to-end.
 *
 * What it does:
 * - Connects admin SDK to the Auth emulator
 * - Creates (or finds) an admin user and sets custom claims { role: 'admin' }
 * - Exchanges a custom token for an ID token (via the Auth emulator REST endpoint)
 * - Calls the callable function `createUserAdmin` with that ID token
 *
 * Usage (from repository root):
 * cd functions
 * node tools/test_create_admin_and_call.js
 *
 * Make sure you start the emulators including `auth` and `functions` first:
 * firebase emulators:start --only functions,firestore,auth --project local-aynialud
 */

const ADMIN_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FUNCTIONS_HOST = process.env.FUNCTIONS_HOST || '127.0.0.1:5001';
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'local-aynialud';

// Ensure admin SDK talks to the Auth emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = ADMIN_EMULATOR_HOST;

const admin = require('firebase-admin');
const fetch = global.fetch || require('node-fetch');

admin.initializeApp({ projectId: PROJECT_ID });

async function main() {
  try {
    const adminEmail = 'admin@local.test';
    const adminPassword = 'password123';

    // Create or find admin user
    let user;
    try {
      user = await admin.auth().getUserByEmail(adminEmail);
      console.log('Found existing user', user.uid);
    } catch (e) {
      console.log('Creating admin user...');
      user = await admin.auth().createUser({ email: adminEmail, password: adminPassword });
      console.log('Created user', user.uid);
    }

    // Set custom claims to role=admin
    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
    console.log('Set custom claims {role: "admin"} for', user.uid);

    // Create a custom token and exchange it for an ID token via the Auth emulator REST API
    const customToken = await admin.auth().createCustomToken(user.uid);
    const signInUrl = `http://${ADMIN_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=any`;
    const signInRes = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    const signInJson = await signInRes.json();
    const idToken = signInJson.idToken;
    if (!idToken) throw new Error('Failed to obtain idToken from emulator: ' + JSON.stringify(signInJson));
    console.log('Obtained idToken for admin user (length)', idToken.length);

    // Call the callable function createUserAdmin
    const funcUrl = `http://${FUNCTIONS_HOST}/${PROJECT_ID}/us-central1/createUserAdmin`;
    // Use a unique email each run to avoid collisions in the Auth emulator
    const newPatientEmail = `newpatient+${Date.now()}@local.test`;
    const payload = {
      data: {
        email: newPatientEmail,
        password: 'patient123',
        name: 'Paciente Test',
        role: 'patient',
        // include idToken in payload as a fallback so the callable can pick it up in tests
        __idToken: idToken
      }
    };

    console.log('Calling callable createUserAdmin...');
    const callRes = await fetch(funcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
    const callJson = await callRes.json();
    console.log('createUserAdmin response status', callRes.status);
    console.log(JSON.stringify(callJson, null, 2));
  } catch (err) {
    console.error('Error in test script:', err);
    process.exitCode = 1;
  }
}

main();
