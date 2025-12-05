import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/common/Modal';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../api/firebaseClient';

const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutExpires, setLockoutExpires] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'enterEmail' | 'enterCode' | 'done'>('enterEmail');
  const [resetMsg, setResetMsg] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  useEffect(() => {
    const storedAttempts = JSON.parse(localStorage.getItem(`loginAttempts_${email}`) || '0');
    const storedLockout = JSON.parse(localStorage.getItem(`lockoutExpires_${email}`) || '0');

    if (storedLockout > Date.now()) {
      setLockoutExpires(storedLockout);
    } else {
      // Lockout expired, reset everything
      localStorage.removeItem(`loginAttempts_${email}`);
      localStorage.removeItem(`lockoutExpires_${email}`);
    }
    setLoginAttempts(storedAttempts);
  }, [email]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutExpires > Date.now()) {
      interval = setInterval(() => {
        if (lockoutExpires <= Date.now()) {
          setLockoutExpires(0);
          setLoginAttempts(0);
          localStorage.removeItem(`loginAttempts_${email}`);
          localStorage.removeItem(`lockoutExpires_${email}`);
          clearInterval(interval);
        }
        // Force re-render to update countdown
        else {
          setLockoutExpires(lockoutExpires => lockoutExpires - 1000);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutExpires, email]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutExpires > Date.now()) {
      const remainingTime = Math.ceil((lockoutExpires - Date.now()) / 1000 / 60);
      setError(`Too many failed login attempts. Please try again in ${remainingTime} minutes.`);
      return;
    }

    setError('');
    setIsLoading(true);

    const success = await login(email, password);

    if (success) {
      localStorage.removeItem(`loginAttempts_${email}`);
      localStorage.removeItem(`lockoutExpires_${email}`);
      navigate('/');
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem(`loginAttempts_${email}`, JSON.stringify(newAttempts));

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const newLockoutExpires = Date.now() + LOCKOUT_TIME;
        setLockoutExpires(newLockoutExpires);
        localStorage.setItem(`lockoutExpires_${email}`, JSON.stringify(newLockoutExpires));
        setError('Too many failed login attempts. You are locked out for 15 minutes.');
      } else {
        setError('Invalid credentials. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const host = (typeof window !== 'undefined' && (window.location.hostname || 'localhost')) || 'localhost';

  // Helper to try common emulator function ports before failing. Tries 5002 then 5001.
  const localHttpGet = async (path: string) => {
    const ports = [5002, 5001];
    for (const port of ports) {
      const url = `http://${host}:${port}${path}`;
      try {
        console.info('[login] trying local HTTP', url);
        const resp = await fetch(url, { method: 'GET' });
        if (resp && resp.ok) return resp;
        console.warn('[login] local HTTP returned', resp && resp.status, url);
      } catch (err) {
        console.warn('[login] local HTTP fetch failed', url, err);
      }
    }
    throw new Error('Local HTTP fallback failed for all ports');
  };

  const openReset = () => {
    setResetEmail('');
    setResetStep('enterEmail');
    setResetMsg('');
    setResetCode('');
    setResetNewPassword('');
    setShowResetModal(true);
  };

  const closeReset = () => {
    setShowResetModal(false);
  };

  const submitRequestReset = async (e?: React.FormEvent) => {
    e && e.preventDefault();
    setResetMsg('');
    if (!resetEmail) { setResetMsg('Please provide an email'); return; }
    setResetLoading(true);
    try {
      // keep existing behaviour: request a code via our functions backend
      const r = await localHttpGet(`/local-aynialud/us-central1/requestPasswordResetHttp?email=${encodeURIComponent(resetEmail)}`);
      if (!r.ok) { const j = await r.json().catch(()=>({})); throw new Error(j?.error || `HTTP ${r.status}`); }
      setResetStep('enterCode');
      setResetMsg('A code was sent to your email. Check your inbox (or emulator logs).');
    } catch (err: any) {
      console.error('requestPasswordReset failed', err);
      setResetMsg(String(err?.message || err));
    } finally { setResetLoading(false); }
  };

  const submitSendResetLink = async (e?: React.FormEvent) => {
    e && e.preventDefault();
    setResetMsg('');
    if (!resetEmail) { setResetMsg('Please provide an email'); return; }
    setResetLoading(true);
    try {
      // Use Firebase client SDK to send standard password reset email (works with Auth emulator)
      // Provide actionCodeSettings so the link redirects back to your app after reset.
      const origin = (typeof window !== 'undefined' && window.location.origin) || 'http://localhost:3000';
      const actionCodeSettings = {
        // URL you want to redirect back to. The domain must be whitelisted in Firebase Console -> Authentication -> Authorized domains
        url: `${origin}/auth/reset-complete`,
        // This must be false for web password resets handled by Firebase's web flow.
        handleCodeInApp: false,
      } as any;
      await sendPasswordResetEmail(auth, resetEmail, actionCodeSettings);
      setResetStep('done');
      setResetMsg('Se ha enviado un enlace de restablecimiento a tu correo. Revisa tu bandeja (o la consola del emulador).');
    } catch (err: any) {
      console.error('sendPasswordResetEmail failed', err);
      setResetMsg(String(err?.message || err));
    } finally { setResetLoading(false); }
  };

  const submitVerifyReset = async (e?: React.FormEvent) => {
    e && e.preventDefault();
    setResetMsg('');
    if (!resetCode || !resetNewPassword) { setResetMsg('Please enter the code and new password'); return; }
    setResetLoading(true);
    try {
  const r = await localHttpGet(`/local-aynialud/us-central1/verifyPasswordResetHttp?email=${encodeURIComponent(resetEmail)}&code=${encodeURIComponent(resetCode)}&newPassword=${encodeURIComponent(resetNewPassword)}`);
  if (!r.ok) { const j = await r.json().catch(()=>({})); throw new Error(j?.error || `HTTP ${r.status}`); }
      setResetStep('done');
      setResetMsg('Password updated. You can now sign in with your new password.');
      // optionally auto-fill the login password field
      setPassword(resetNewPassword);
      setTimeout(() => { setShowResetModal(false); }, 1200);
    } catch (err: any) {
      console.error('verifyPasswordReset failed', err);
      setResetMsg(String(err?.message || err));
    } finally { setResetLoading(false); }
  };

  const isLockedOut = lockoutExpires > Date.now();
  const remainingTime = Math.ceil((lockoutExpires - Date.now()) / 1000);


  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="p-8 bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-6">
            <img src="/imagenes/logo.png" alt="Logo" className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Welcome to AyniSalud Integral</h2>
        <p className="text-center text-gray-500 mb-8">Sign in to your account</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="e.g., mendoza@aynisalud.com"
              required
              disabled={isLockedOut}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="Your password"
              required
              disabled={isLockedOut}
            />
          </div>
          {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
          {isLockedOut && (
            <p className="text-red-500 text-xs italic mb-4">
              Too many failed attempts. Please try again in {Math.ceil(remainingTime / 60)} minutes ({remainingTime} seconds).
            </p>
          )}
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={isLoading || isLockedOut}
              className="w-full bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200 disabled:bg-gray-400"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
          <div className="mt-4 text-center">
            <button type="button" onClick={openReset} className="text-sm text-teal-600 hover:underline">¿Olvidaste tu contraseña?</button>
          </div>
        </form>
      </div>

      <Modal isOpen={showResetModal} onClose={closeReset} title="Recuperar contraseña" size="md">
        {resetStep === 'enterEmail' && (
          <form onSubmit={(e)=>{ e.preventDefault(); /* no-op, use explicit buttons */ }}>
            <p className="text-sm text-gray-600 mb-4">Ingresa tu correo electrónico y elige cómo deseas recuperar el acceso:</p>
            <input type="email" value={resetEmail} onChange={(e)=>setResetEmail(e.target.value)} className="w-full mb-3 p-2 border rounded" placeholder="tu@correo.com" required />
            {resetMsg && <p className="text-sm text-red-500 mb-2">{resetMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeReset} className="px-3 py-2 border rounded">Cancelar</button>
              <button type="button" disabled={resetLoading} onClick={submitRequestReset} className="px-3 py-2 bg-teal-500 text-white rounded">{resetLoading ? 'Procesando...' : 'Recuperar con código'}</button>
              <button type="button" disabled={resetLoading} onClick={submitSendResetLink} className="px-3 py-2 bg-indigo-600 text-white rounded">{resetLoading ? 'Procesando...' : 'Recuperar con link'}</button>
            </div>
          </form>
        )}

        {resetStep === 'enterCode' && (
          <form onSubmit={submitVerifyReset}>
            <p className="text-sm text-gray-600 mb-4">Ingresa el código recibido y tu nueva contraseña.</p>
            <input type="text" value={resetCode} onChange={(e)=>setResetCode(e.target.value)} className="w-full mb-3 p-2 border rounded" placeholder="Código" required />
            <input type="password" value={resetNewPassword} onChange={(e)=>setResetNewPassword(e.target.value)} className="w-full mb-3 p-2 border rounded" placeholder="Nueva contraseña" required />
            {resetMsg && <p className="text-sm text-red-500 mb-2">{resetMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeReset} className="px-3 py-2 border rounded">Cancelar</button>
              <button type="submit" disabled={resetLoading} className="px-3 py-2 bg-teal-500 text-white rounded">{resetLoading ? 'Verificando...' : 'Actualizar contraseña'}</button>
            </div>
          </form>
        )}

        {resetStep === 'done' && (
          <div>
            <p className="text-sm text-gray-700 mb-4">{resetMsg}</p>
            <div className="flex justify-end">
              <button onClick={closeReset} className="px-3 py-2 bg-teal-500 text-white rounded">Cerrar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LoginPage;

