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
exports.makeHttpHandler = makeHttpHandler;
const functions = __importStar(require("firebase-functions"));
function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}
function parseBody(body) {
    if (!body)
        return {};
    if (typeof body === 'string') {
        try {
            return JSON.parse(body);
        }
        catch (e) {
            return {};
        }
    }
    if (typeof body === 'object')
        return body;
    return {};
}
function getRequestData(req) {
    const query = {};
    for (const [key, value] of Object.entries(req.query || {})) {
        if (Array.isArray(value)) {
            query[key] = value[value.length - 1];
        }
        else {
            query[key] = value;
        }
    }
    const body = req.method === 'GET' ? {} : parseBody(req.body);
    return { ...query, ...body };
}
function mapHttpsErrorToStatus(code) {
    switch (code) {
        case 'invalid-argument':
            return 400;
        case 'failed-precondition':
            return 412;
        case 'permission-denied':
        case 'unauthenticated':
            return 403;
        case 'not-found':
            return 404;
        case 'already-exists':
            return 409;
        case 'resource-exhausted':
            return 429;
        case 'unavailable':
            return 503;
        case 'deadline-exceeded':
            return 504;
        default:
            return 500;
    }
}
function makeHttpHandler(handler) {
    return functions.https.onRequest(async (req, res) => {
        setCorsHeaders(res);
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        try {
            const data = getRequestData(req);
            const context = { rawRequest: req };
            const result = await handler(data, context);
            res.json(result);
        }
        catch (err) {
            console.error('HTTP handler error', err && err.stack ? err.stack : err);
            if (err instanceof functions.https.HttpsError) {
                res.status(mapHttpsErrorToStatus(err.code)).json({ error: err.message, code: err.code });
                return;
            }
            res.status(500).json({ error: err?.message || 'internal-error' });
        }
    });
}
