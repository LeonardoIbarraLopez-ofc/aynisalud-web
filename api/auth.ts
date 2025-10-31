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
          const url = `http://${host}:5002/local-aynialud/us-central1/getMyProfileHttp?idToken=${encodeURIComponent(idToken)}`;
          console.info('[auth] Using local HTTP profile fallback', url);
          const resp = await fetch(url, { method: 'GET' });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data && (data as any).profile) {
            localStorage.setItem('aynisalud_user_id', ((data as any).profile as any).id);
            return (data as any).profile as User;
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
      // store minimal info locally
      localStorage.setItem('aynisalud_user_id', (data.profile as any).id);
      return data.profile as User;
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
