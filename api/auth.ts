import { type User } from '../types';
import { auth, functions } from './firebaseClient';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

// Authenticate with Firebase Auth (emulator during development) and fetch profile from backend
export const login = async (email: string, password: string): Promise<User | undefined> => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Prefer callable in production; for local emulator some environments have CORS issues
    // with callable preflight — fall back to a simple HTTP endpoint when running on localhost.
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try {
          const idToken = await cred.user.getIdToken();
          // Use a simple GET + query param for local emulator fallback to avoid CORS preflight
          // (no custom headers => no OPTIONS). For local/dev only.
          const host = window.location.hostname || 'localhost';
          // localHttpGet will try common emulator ports (5002 then 5001) and return
          // the first successful response. This avoids hard-failing if the functions
          // emulator started on a different port.
          const localHttpGet = async (path: string) => {
            const ports = [5002, 5001];
            for (const port of ports) {
              const url = `http://${host}:${port}${path}`;
              try {
                console.info('[auth] trying local HTTP fallback', url);
                const resp = await fetch(url, { method: 'GET' });
                if (resp && resp.ok) return resp;
                console.warn('[auth] local fallback responded with status', resp && resp.status, url);
              } catch (err) {
                console.warn('[auth] local fallback fetch failed', url, err);
              }
            }
            throw new Error('Local HTTP fallback failed for all ports');
          };

          const resp = await localHttpGet(`/local-aynialud/us-central1/getMyProfileHttp?idToken=${encodeURIComponent(idToken)}`);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data && (data as any).profile) {
            const profile = (data as any).profile as User & { role?: string };
            // If admin, require email 2FA confirmation
            if (profile.role === 'admin') {
              try {
                // Use HTTP GET fallback to avoid preflight on localhost
                const idTokenLocal = await cred.user.getIdToken();
                const r = await localHttpGet(`/local-aynialud/us-central1/requestAdmin2FAHttp?idToken=${encodeURIComponent(idTokenLocal)}`);
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                // prompt loop for code verification
                let verified = false;
                for (let attempt = 0; attempt < 3; attempt++) {
                  const code = window.prompt('Ingrese el código enviado a su correo (admin 2FA):');
                  if (!code) break;
                  try {
                    const vr = await localHttpGet(`/local-aynialud/us-central1/verifyAdmin2FAHttp?idToken=${encodeURIComponent(idTokenLocal)}&code=${encodeURIComponent(code)}`);
                    if (!vr.ok) throw new Error(`HTTP ${vr.status}`);
                    const vdata = await vr.json();
                    if (vdata && vdata.success) { verified = true; break; }
                  } catch (e) {
                    console.warn('2FA verify attempt failed', e);
                  }
                }
                if (!verified) {
                  await signOut(auth);
                  return undefined;
                }
              } catch (e) {
                console.error('requestAdmin2FA failed', e);
                await signOut(auth);
                return undefined;
              }
            }

            localStorage.setItem('aynisalud_user_id', profile.id as any);
            return profile as User;
          }
          return undefined;
        } catch (e) {
          console.warn('Local HTTP profile fetch failed, falling back to callable', e);
        }
    }
    // production / default: call backend callable to get the users/{uid} profile and claims
    const getMyProfile = httpsCallable(functions, 'getMyProfile');
  const res = await getMyProfile({});
  // the callable SDK returns `data` of unknown type; cast safely
  const data = res.data as any;
    if (data && data.profile) {
      const profile = data.profile as User & { role?: string };
      if (profile.role === 'admin') {
        try {
          const req = httpsCallable(functions, 'requestAdmin2FA');
          await req({});
          let verified = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            const code = window.prompt('Ingrese el código enviado a su correo (admin 2FA):');
            if (!code) break;
            try {
              const verify = httpsCallable(functions, 'verifyAdmin2FA');
              const verifyRes = await verify({ code });
              const vdata = (verifyRes as any).data || verifyRes;
              if (vdata && vdata.success) { verified = true; break; }
            } catch (e) {
              console.warn('2FA verify attempt failed', e);
            }
          }
          if (!verified) {
            await signOut(auth);
            return undefined;
          }
        } catch (e) {
          console.error('requestAdmin2FA failed', e);
          await signOut(auth);
          return undefined;
        }
      }

      // store minimal info locally
      localStorage.setItem('aynisalud_user_id', profile.id as any);
      return profile as User;
    }
    return undefined;
  } catch (e) {
    console.error('Auth login failed', e);
    return undefined;
  }
};

export const getMe = async (): Promise<User | undefined> => {
  try {
    // If user is signed in with Firebase, call backend to get profile
    const current = auth.currentUser;
    if (!current) return undefined;
    const getMyProfile = httpsCallable(functions, 'getMyProfile');
    const res = await getMyProfile({});
    const data = res.data as any;
    if (data && data.profile) return data.profile as User;
    return undefined;
  } catch (e) {
    console.error('getMe failed', e);
    return undefined;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('signOut failed', e);
  }
  localStorage.removeItem('aynisalud_user_id');
};
