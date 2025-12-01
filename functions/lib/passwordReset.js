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
exports.verifyPasswordResetHttp = exports.requestPasswordResetHttp = void 0;
const functions = __importStar(require("firebase-functions"));
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const utils_1 = require("./utils");
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function hashCode(code, secret) {
    return crypto.createHmac('sha256', secret).update(code).digest('hex');
}
async function sendEmail(to, subject, text) {
    console.info('[passwordReset] (log) email', { to, subject, text });
    const smtpUrl = process.env.ADMIN_2FA_SMTP_URL;
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;
    if (!smtpUrl && !(smtpHost && smtpUser && smtpPass))
        return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodemailer = require('nodemailer');
        let transporter = null;
        if (smtpUrl)
            transporter = nodemailer.createTransport(String(smtpUrl));
        else {
            const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
            const secure = (process.env.SMTP_SECURE === 'true');
            transporter = nodemailer.createTransport({ host: smtpHost, port, secure: !!secure, auth: { user: smtpUser, pass: smtpPass } });
        }
        await transporter.sendMail({ from: process.env.ADMIN_2FA_FROM || 'no-reply@example.com', to, subject, text });
        console.info('[passwordReset] Email sent to', to);
    }
    catch (e) {
        console.warn('[passwordReset] Failed to send email via SMTP', e && e.message ? e.message : String(e));
        console.info('[passwordReset] Email fallback log:', { to, subject, text });
    }
}
// HTTP: request a password reset code (GET ?email=...)
exports.requestPasswordResetHttp = functions.https.onRequest(async (req, res) => {
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
        const email = (req.query && req.query.email) ? String(req.query.email).toLowerCase() : null;
        if (!email) {
            res.status(400).json({ error: 'email required' });
            return;
        }
        const code = generateCode();
        const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
        const codeHash = hashCode(code, secret);
        const now = Date.now();
        // store by email to avoid requiring an idToken
        const doc = { email, codeHash, used: false, createdAt: now, expiresAt: now + CODE_TTL_MS };
        await utils_1.db.collection('passwordResets').add(doc);
        // log the code for emulator/dev convenience
        console.info('[passwordReset] generated code', { email, code });
        try {
            // attempt to send email via SMTP (or console fallback)
            const subject = 'Password reset code';
            const text = `Tu código para reestablecer la contraseña es: ${code} (válido por 15 minutos)`;
            await sendEmail(email, subject, text);
        }
        catch (e) {
            console.warn('[passwordReset] send email failed', e);
        }
        await (0, utils_1.auditLog)('anonymous', 'request_password_reset', 'passwordResets', '', { email, createdAt: now });
        res.json({ success: true, expiresInMs: CODE_TTL_MS });
    }
    catch (e) {
        console.error('[passwordReset] error', e);
        res.status(500).json({ error: e?.message || String(e) });
    }
});
// HTTP: verify code and set new password (GET ?email=...&code=...&newPassword=...)
exports.verifyPasswordResetHttp = functions.https.onRequest(async (req, res) => {
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
        const email = (req.query && req.query.email) ? String(req.query.email).toLowerCase() : null;
        const code = (req.query && req.query.code) ? String(req.query.code) : null;
        const newPassword = (req.query && req.query.newPassword) ? String(req.query.newPassword) : null;
        if (!email) {
            res.status(400).json({ error: 'email required' });
            return;
        }
        if (!code) {
            res.status(400).json({ error: 'code required' });
            return;
        }
        if (!newPassword) {
            res.status(400).json({ error: 'newPassword required' });
            return;
        }
        const secret = process.env.ADMIN_2FA_SECRET || 'dev-secret';
        const candidates = await utils_1.db.collection('passwordResets')
            .where('email', '==', email)
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
        // find user by email and update password
        // admin SDK is available via utils initialization, but import locally to satisfy TS
        // (we also imported admin at top)
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
        }
        catch (e) {
            console.warn('[passwordReset] getUserByEmail failed', e);
            res.status(404).json({ error: 'user-not-found' });
            return;
        }
        await admin.auth().updateUser(userRecord.uid, { password: newPassword });
        await matchedDoc.ref.update({ used: true, usedAt: now });
        await (0, utils_1.auditLog)(userRecord.uid, 'verify_password_reset', 'passwordResets', userRecord.uid, { usedAt: now });
        res.json({ success: true });
    }
    catch (e) {
        console.error('[passwordReset] verify error', e);
        res.status(500).json({ error: e?.message || String(e) });
    }
});
