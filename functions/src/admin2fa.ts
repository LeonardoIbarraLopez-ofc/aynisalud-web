import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import { db, requireAuth, auditLog, isAdmin } from './utils';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

function hashCode(code: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(code).digest('hex');
}

async function sendEmail(to: string, subject: string, text: string) {
  // Always log the email body to console for dev/emulator so developer can see the code.
  console.info('[admin2fa] (log) email', { to, subject, text });

  // Try to send via SMTP if configuration is available. Support two ways to configure:
  // 1) ADMIN_2FA_SMTP_URL (single connection URL, e.g. smtp://user:pass@host:port)
  // 2) SMTP_HOST + SMTP_USER + SMTP_PASSWORD (+ optional SMTP_PORT, SMTP_SECURE)
  const smtpUrl = process.env.ADMIN_2FA_SMTP_URL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  if (!smtpUrl && !(smtpHost && smtpUser && smtpPass)) {
    // no SMTP configuration found — leave only the console log
    return;
  }

  try {
    // Lazy require so functions without nodemailer still load until send is needed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer');
    let transporter: any = null;
    if (smtpUrl) {
      transporter = nodemailer.createTransport(String(smtpUrl));
    } else {
      const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
      const secure = (process.env.SMTP_SECURE === 'true');
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: port,
        secure: !!secure,
        auth: { user: smtpUser, pass: smtpPass },
      });
    }

    // send mail
    await transporter.sendMail({ from: process.env.ADMIN_2FA_FROM || 'no-reply@example.com', to, subject, text });
    console.info('[admin2fa] Email sent to', to);
  } catch (e: any) {
    console.warn('[admin2fa] Failed to send email via SMTP (nodemailer). Falling back to console log', e && e.message ? e.message : String(e));
    console.info('[admin2fa] Email fallback log:', { to, subject, text });
  }
}

// Callable: requestAdmin2FA
export const requestAdmin2FA = functions.https.onCall(async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Missing uid');
  // Only admins should request admin 2FA
  if (!isAdmin(token)) throw new functions.https.HttpsError('permission-denied', 'Not an admin');

  const code = generateCode();
  const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
  const codeHash = hashCode(code, secret);
  // Always log the generated code and uid to ensure developers can see it in emulator logs
  console.info('[admin2fa] generated code', { uid, code });
  const now = Date.now();
  const doc = {
    uid,
    codeHash,
    used: false,
    createdAt: now,
    expiresAt: now + CODE_TTL_MS,
  } as any;

  // Store the code hash in Firestore
  await db.collection('admin2fa').add(doc);

  // Send email to the admin's account email (we can fetch user record)
  try {
    const userRecord = await (await import('firebase-admin')).auth().getUser(uid);
    const email = userRecord.email || '';
    const subject = 'Your admin sign-in code';
    const text = `Su código de verificación para inicio de sesión es: ${code} (válido por 10 minutos)`;
    await sendEmail(email, subject, text);
  } catch (e) {
    console.warn('[admin2fa] could not fetch user email or send email', e);
  }

  // Audit
  await auditLog(uid, 'request_admin_2fa', 'admin2fa', uid, { createdAt: now });

  return { success: true, expiresInMs: CODE_TTL_MS };
});

// Callable: verifyAdmin2FA
export const verifyAdmin2FA = functions.https.onCall(async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Missing uid');
  if (!isAdmin(token)) throw new functions.https.HttpsError('permission-denied', 'Not an admin');

  const { code } = data || {};
  if (!code || typeof code !== 'string') throw new functions.https.HttpsError('invalid-argument', 'code required');

  const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
  const candidates = await db.collection('admin2fa')
    .where('uid', '==', uid)
    .where('used', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  if (candidates.empty) throw new functions.https.HttpsError('not-found', 'No 2FA code requested');

  const now = Date.now();
  let matchedDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (const doc of candidates.docs) {
    const d = doc.data() as any;
    if (d.expiresAt && now > d.expiresAt) continue;
    const hash = hashCode(code, secret);
    if (hash === d.codeHash) {
      matchedDoc = doc;
      break;
    }
  }

  if (!matchedDoc) {
    throw new functions.https.HttpsError('permission-denied', 'Invalid or expired code');
  }

  // Mark used
  await matchedDoc.ref.update({ used: true, usedAt: now });

  // Audit
  await auditLog(uid, 'verify_admin_2fa', 'admin2fa', uid, { usedAt: now });

  return { success: true };
});

// HTTP fallback endpoints (for local dev) to avoid browser preflight issues.
// These accept GET requests with idToken in query string to avoid custom headers.
export const requestAdmin2FAHttp = functions.https.onRequest(async (req, res) => {
  // CORS simple handling: allow localhost dev origin and respond to OPTIONS
  const origin = req.headers.origin || req.headers.Origin || '';
  const allowedOrigin = (origin && origin.includes('localhost')) ? origin : 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const idToken = (req.query && req.query.idToken) ? String(req.query.idToken) : null;
    if (!idToken) {
      res.status(400).json({ error: 'idToken required' });
      return;
    }
    const decoded = await (await import('firebase-admin')).auth().verifyIdToken(idToken);
  if (!decoded || !decoded.uid) { res.status(401).json({ error: 'unauthenticated' }); return; }
  if (!isAdmin(decoded)) { res.status(403).json({ error: 'not-admin' }); return; }

    const code = generateCode();
    const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
    const codeHash = hashCode(code, secret);
  // Always log the generated code and uid so it appears in emulator logs (HTTP fallback)
  console.info('[admin2fa:http] generated code', { uid: decoded.uid, code });
    const now = Date.now();
    const doc = { uid: decoded.uid, codeHash, used: false, createdAt: now, expiresAt: now + CODE_TTL_MS } as any;
    await db.collection('admin2fa').add(doc);

    try {
      const userRecord = await (await import('firebase-admin')).auth().getUser(decoded.uid);
      const email = userRecord.email || '';
      const subject = 'Your admin sign-in code';
      const text = `Su código de verificación para inicio de sesión es: ${code} (válido por 10 minutos)`;
      await sendEmail(email, subject, text);
    } catch (e) {
      console.warn('[admin2fa:http] could not fetch user email or send email', e);
    }

    await auditLog(decoded.uid, 'request_admin_2fa_http', 'admin2fa', decoded.uid, { createdAt: now });
    res.json({ success: true, expiresInMs: CODE_TTL_MS });
  } catch (e: any) {
    console.error('[admin2fa:http] error', e);
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export const verifyAdmin2FAHttp = functions.https.onRequest(async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin || '';
  const allowedOrigin = (origin && origin.includes('localhost')) ? origin : 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const idToken = (req.query && req.query.idToken) ? String(req.query.idToken) : null;
    const code = (req.query && req.query.code) ? String(req.query.code) : null;
  if (!idToken) { res.status(400).json({ error: 'idToken required' }); return; }
  if (!code) { res.status(400).json({ error: 'code required' }); return; }
  const decoded = await (await import('firebase-admin')).auth().verifyIdToken(idToken);
  if (!decoded || !decoded.uid) { res.status(401).json({ error: 'unauthenticated' }); return; }
  if (!isAdmin(decoded)) { res.status(403).json({ error: 'not-admin' }); return; }

    const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
    const candidates = await db.collection('admin2fa')
      .where('uid', '==', decoded.uid)
      .where('used', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

  if (candidates.empty) { res.status(404).json({ error: 'no-code' }); return; }

    const now = Date.now();
    let matchedDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    for (const doc of candidates.docs) {
      const d = doc.data() as any;
      if (d.expiresAt && now > d.expiresAt) continue;
      const hash = hashCode(code, secret);
      if (hash === d.codeHash) { matchedDoc = doc; break; }
    }

  if (!matchedDoc) { res.status(403).json({ error: 'invalid-or-expired' }); return; }
  await matchedDoc.ref.update({ used: true, usedAt: now });
  await auditLog(decoded.uid, 'verify_admin_2fa_http', 'admin2fa', decoded.uid, { usedAt: now });
  res.json({ success: true });
  } catch (e: any) {
    console.error('[admin2fa:http] verify error', e);
    res.status(500).json({ error: e?.message || String(e) });
  }
});
