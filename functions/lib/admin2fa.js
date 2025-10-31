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
exports.verifyAdmin2FAHttp = exports.requestAdmin2FAHttp = exports.verifyAdmin2FA = exports.requestAdmin2FA = void 0;
const functions = __importStar(require("firebase-functions"));
const crypto = __importStar(require("crypto"));
const utils_1 = require("./utils");
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}
function hashCode(code, secret) {
    return crypto.createHmac('sha256', secret).update(code).digest('hex');
}
async function sendEmail(to, subject, text) {
    // In emulator/dev we might not have SMTP configured. If an SMTP URL is provided
    // in ADMIN_2FA_SMTP_URL, attempt to send via nodemailer. Otherwise just log.
    const smtpUrl = process.env.ADMIN_2FA_SMTP_URL;
    if (!smtpUrl) {
        console.info('[admin2fa] No SMTP configured, logging code to console (dev/emulator):', { to, subject, text });
        return;
    }
    try {
        // Import lazily so production only installs nodemailer when needed
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport(smtpUrl);
        await transporter.sendMail({ from: process.env.ADMIN_2FA_FROM || 'no-reply@example.com', to, subject, text });
        console.info('[admin2fa] Email sent to', to);
    }
    catch (e) {
        console.warn('[admin2fa] Failed to send email, falling back to console log', e);
        console.info('[admin2fa] Email fallback log:', { to, subject, text });
    }
}
// Callable: requestAdmin2FA
exports.requestAdmin2FA = functions.https.onCall(async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    if (!uid)
        throw new functions.https.HttpsError('unauthenticated', 'Missing uid');
    // Only admins should request admin 2FA
    if (!(0, utils_1.isAdmin)(token))
        throw new functions.https.HttpsError('permission-denied', 'Not an admin');
    const code = generateCode();
    const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
    const codeHash = hashCode(code, secret);
    const now = Date.now();
    const doc = {
        uid,
        codeHash,
        used: false,
        createdAt: now,
        expiresAt: now + CODE_TTL_MS,
    };
    // Store the code hash in Firestore
    await utils_1.db.collection('admin2fa').add(doc);
    // Send email to the admin's account email (we can fetch user record)
    try {
        const userRecord = await (await Promise.resolve().then(() => __importStar(require('firebase-admin')))).auth().getUser(uid);
        const email = userRecord.email || '';
        const subject = 'Your admin sign-in code';
        const text = `Su código de verificación para inicio de sesión es: ${code} (válido por 10 minutos)`;
        await sendEmail(email, subject, text);
    }
    catch (e) {
        console.warn('[admin2fa] could not fetch user email or send email', e);
    }
    // Audit
    await (0, utils_1.auditLog)(uid, 'request_admin_2fa', 'admin2fa', uid, { createdAt: now });
    return { success: true, expiresInMs: CODE_TTL_MS };
});
// Callable: verifyAdmin2FA
exports.verifyAdmin2FA = functions.https.onCall(async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    if (!uid)
        throw new functions.https.HttpsError('unauthenticated', 'Missing uid');
    if (!(0, utils_1.isAdmin)(token))
        throw new functions.https.HttpsError('permission-denied', 'Not an admin');
    const { code } = data || {};
    if (!code || typeof code !== 'string')
        throw new functions.https.HttpsError('invalid-argument', 'code required');
    const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
    const candidates = await utils_1.db.collection('admin2fa')
        .where('uid', '==', uid)
        .where('used', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
    if (candidates.empty)
        throw new functions.https.HttpsError('not-found', 'No 2FA code requested');
    const now = Date.now();
    let matchedDoc = null;
    for (const doc of candidates.docs) {
        const d = doc.data();
        if (d.expiresAt && now > d.expiresAt)
            continue;
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
    await (0, utils_1.auditLog)(uid, 'verify_admin_2fa', 'admin2fa', uid, { usedAt: now });
    return { success: true };
});
// HTTP fallback endpoints (for local dev) to avoid browser preflight issues.
// These accept GET requests with idToken in query string to avoid custom headers.
exports.requestAdmin2FAHttp = functions.https.onRequest(async (req, res) => {
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
        const decoded = await (await Promise.resolve().then(() => __importStar(require('firebase-admin')))).auth().verifyIdToken(idToken);
        if (!decoded || !decoded.uid) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        if (!(0, utils_1.isAdmin)(decoded)) {
            res.status(403).json({ error: 'not-admin' });
            return;
        }
        const code = generateCode();
        const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
        const codeHash = hashCode(code, secret);
        const now = Date.now();
        const doc = { uid: decoded.uid, codeHash, used: false, createdAt: now, expiresAt: now + CODE_TTL_MS };
        await utils_1.db.collection('admin2fa').add(doc);
        try {
            const userRecord = await (await Promise.resolve().then(() => __importStar(require('firebase-admin')))).auth().getUser(decoded.uid);
            const email = userRecord.email || '';
            const subject = 'Your admin sign-in code';
            const text = `Su código de verificación para inicio de sesión es: ${code} (válido por 10 minutos)`;
            await sendEmail(email, subject, text);
        }
        catch (e) {
            console.warn('[admin2fa:http] could not fetch user email or send email', e);
        }
        await (0, utils_1.auditLog)(decoded.uid, 'request_admin_2fa_http', 'admin2fa', decoded.uid, { createdAt: now });
        res.json({ success: true, expiresInMs: CODE_TTL_MS });
    }
    catch (e) {
        console.error('[admin2fa:http] error', e);
        res.status(500).json({ error: e?.message || String(e) });
    }
});
exports.verifyAdmin2FAHttp = functions.https.onRequest(async (req, res) => {
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
        if (!idToken) {
            res.status(400).json({ error: 'idToken required' });
            return;
        }
        if (!code) {
            res.status(400).json({ error: 'code required' });
            return;
        }
        const decoded = await (await Promise.resolve().then(() => __importStar(require('firebase-admin')))).auth().verifyIdToken(idToken);
        if (!decoded || !decoded.uid) {
            res.status(401).json({ error: 'unauthenticated' });
            return;
        }
        if (!(0, utils_1.isAdmin)(decoded)) {
            res.status(403).json({ error: 'not-admin' });
            return;
        }
        const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
        const candidates = await utils_1.db.collection('admin2fa')
            .where('uid', '==', decoded.uid)
            .where('used', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        if (candidates.empty) {
            res.status(404).json({ error: 'no-code' });
            return;
        }
        const now = Date.now();
        let matchedDoc = null;
        for (const doc of candidates.docs) {
            const d = doc.data();
            if (d.expiresAt && now > d.expiresAt)
                continue;
            const hash = hashCode(code, secret);
            if (hash === d.codeHash) {
                matchedDoc = doc;
                break;
            }
        }
        if (!matchedDoc) {
            res.status(403).json({ error: 'invalid-or-expired' });
            return;
        }
        await matchedDoc.ref.update({ used: true, usedAt: now });
        await (0, utils_1.auditLog)(decoded.uid, 'verify_admin_2fa_http', 'admin2fa', decoded.uid, { usedAt: now });
        res.json({ success: true });
    }
    catch (e) {
        console.error('[admin2fa:http] verify error', e);
        res.status(500).json({ error: e?.message || String(e) });
    }
});
