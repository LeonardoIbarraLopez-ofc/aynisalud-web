import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebaseClient';

const FUNCTION_PORTS = [5002, 5001];

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

async function fetchWithFallback<T>(name: string, payload: Record<string, unknown>): Promise<T> {
  if (!isLocalHost()) {
    throw new Error('No local fallback available');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user for fallback');
  }

  const idToken = await currentUser.getIdToken();
  const host = window.location.hostname || 'localhost';
  const body = JSON.stringify({ ...payload, idToken });
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  } as const;

  for (const port of FUNCTION_PORTS) {
    const url = `http://${host}:${port}/local-aynialud/us-central1/${name}Http`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`[functionsClient] HTTP fallback ${name} -> ${response.status}: ${text}`);
        continue;
      }

      const json = await response.json();
      if (json && json.error) {
        throw new Error(String(json.error));
      }
      return json as T;
    } catch (err) {
      console.warn(`[functionsClient] HTTP fallback ${name} failed`, err);
    }
  }

  throw new Error(`Local fallback for ${name} failed on all ports`);
}

export async function callBackendFunction<T = any>(name: string, payload: Record<string, unknown> = {}): Promise<T> {
  const callable = httpsCallable(functions, name);
  try {
    const result = await callable(payload);
    const data = (result as any)?.data ?? result;
    return data as T;
  } catch (err) {
    console.warn(`[functionsClient] callable ${name} failed`, err);
    try {
      return await fetchWithFallback<T>(name, payload);
    } catch (fallbackError) {
      console.warn(`[functionsClient] fallback ${name} failed`, fallbackError);
      throw err;
    }
  }
}
