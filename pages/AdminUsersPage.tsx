import React, { useState, useEffect } from 'react';
import { functions } from '../api/firebaseClient';
import { httpsCallable } from 'firebase/functions';

const roles = ['patient', 'doctor', 'specialist', 'receptionist', 'admin'] as const;
const roleTranslations: { [key in typeof roles[number]]: string } = {
  patient: 'Paciente',
  doctor: 'Doctor',
  specialist: 'Especialista',
  receptionist: 'Recepcionista',
  admin: 'Administrador',
};

const AdminUsersPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<typeof roles[number]>('patient');
  const [clinicId, setClinicId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    if (password.length < 6) {
      errors.push('Debe tener al menos 6 caracteres.');
    }
    if (!/[A-Za-z]/.test(password)) {
      errors.push('Debe contener al menos una letra.');
    }
    if (!/\d/.test(password)) {
      errors.push('Debe contener al menos un número.');
    }
    setPasswordErrors(errors);
  };

  useEffect(() => {
    if (password) {
      validatePassword(password);
    }
     else {
      setPasswordErrors([]);
    }
  }, [password]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    validatePassword(newPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    validatePassword(password);
    if (passwordErrors.length > 0) {
      setMessage('La contraseña no cumple con los requisitos.');
      return;
    }

    setMessage(null);
    setIsSubmitting(true);
    try {
      const createUserAdmin = httpsCallable(functions, 'createUserAdmin');
      const data: any = { email, password, name, role };
      if (clinicId) data.clinicId = clinicId;
      const res = await createUserAdmin(data) as any;
      const out = (res && res.data) ? (res.data as any) : (res as any);
      setMessage(`Usuario creado correctamente. uid=${out?.uid ?? 'unknown'}`);
      setEmail(''); setPassword(''); setName(''); setClinicId(''); setRole('patient');
    } catch (err: any) {
      console.error('createUserAdmin failed', err);
      setMessage(err?.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Usuarios</h2>
      <p className="text-sm text-gray-600 mb-6">Crea usuarios para la plataforma. Selecciona el rol y proporciona correo/contraseña.</p>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow">
        <div className="grid grid-cols-1 gap-6">
          <label className="block">
            <span className="text-gray-700">Nombre</span>
            <input className="mt-2 block w-full" value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label className="block">
            <span className="text-gray-700">Email</span>
            <input type="email" className="mt-2 block w-full" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>

          <label className="block">
            <span className="text-gray-700">Contraseña</span>
            <input type="password" className="mt-2 block w-full" value={password} onChange={handlePasswordChange} required />
            {passwordErrors.length > 0 && (
              <div className="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                <p className="font-bold">La contraseña debe cumplir con lo siguiente:</p>
                <ul className="list-disc list-inside pl-2">
                  {passwordErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </label>

          <label className="block">
            <span className="text-gray-700">Rol</span>
            <select className="mt-2 block w-full" value={role} onChange={e => setRole(e.target.value as any)}>
              {roles.map(r => <option key={r} value={r}>{roleTranslations[r]}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-gray-700">Clinic ID (opcional)</span>
            <input className="mt-2 block w-full" value={clinicId} onChange={e => setClinicId(e.target.value)} />
          </label>

          <div className="flex items-center space-x-4 pt-4">
            <button type="submit" disabled={isSubmitting || passwordErrors.length > 0} className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 disabled:bg-gray-400">
              {isSubmitting ? 'Creando...' : 'Crear Usuario'}
            </button>
            {message && <div className="text-sm text-gray-700 p-3 bg-gray-100 rounded-lg">{message}</div>}
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminUsersPage;


