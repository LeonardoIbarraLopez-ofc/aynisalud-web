import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'fake',
  authDomain: 'localhost',
  projectId: 'local-aynialud',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

// If running on localhost, connect to emulator instances
if (typeof window !== 'undefined') {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    try {
      // prefer localhost hostnames for CORS consistency with browser origin
      // NOTE: ports were adjusted in firebase.json to avoid conflicts
  connectAuthEmulator(auth, 'http://localhost:9100', { disableWarnings: true });
  console.info('Connected Auth emulator at http://localhost:9100');
    } catch (e) {
      // ignore if emulator not available
      // eslint-disable-next-line no-console
      console.warn('connectAuthEmulator failed', e);
    }
    try {
      // use 'localhost' as host to match browser Origin and avoid CORS mismatch
  connectFunctionsEmulator(functions, 'localhost', 5002);
  console.info('Connected Functions emulator at http://localhost:5002');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('connectFunctionsEmulator failed', e);
    }
  }
}

export { app, auth, functions };
