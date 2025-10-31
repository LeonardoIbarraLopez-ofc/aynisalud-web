const functions = require('firebase-functions');

// Minimal placeholder function so the Functions emulator loads without error.
// Replace or expand with your real Cloud Functions (TypeScript in src/ -> compiled to lib/ or index.js) later.
exports.heartbeat = functions.https.onRequest((req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});
