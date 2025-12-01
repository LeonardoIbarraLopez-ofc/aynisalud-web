import * as functions from 'firebase-functions';
import { Request, Response } from 'express';

export type CallableHandler = (data: any, context: any) => Promise<any>;

function setCorsHeaders(res: Response) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
}

function parseBody(body: any): any {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      return {};
    }
  }
  if (typeof body === 'object') return body;
  return {};
}

function getRequestData(req: Request): any {
  const query: Record<string, any> = {};
  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value)) {
      query[key] = value[value.length - 1];
    } else {
      query[key] = value as any;
    }
  }
  const body = req.method === 'GET' ? {} : parseBody(req.body);
  return { ...query, ...body };
}

function mapHttpsErrorToStatus(code: functions.https.FunctionsErrorCode): number {
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

export function makeHttpHandler(handler: CallableHandler) {
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
    } catch (err: any) {
      console.error('HTTP handler error', err && err.stack ? err.stack : err);
      if (err instanceof functions.https.HttpsError) {
        res.status(mapHttpsErrorToStatus(err.code)).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err?.message || 'internal-error' });
    }
  });
}
