import React, { useState } from 'react';
import { functions } from '../api/firebaseClient';
import { httpsCallable } from 'firebase/functions';

const roles = ['patient', 'doctor', 'specialist', 'receptionist', 'admin'] as const;

const AdminUsersPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<typeof roles[number]>('patient');
  const [clinicId, setClinicId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow">
        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <span className="text-gray-700">Nombre</span>
            <input className="mt-1 block w-full" value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label className="block">
            <span className="text-gray-700">Email</span>
            <input type="email" className="mt-1 block w-full" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>

          <label className="block">
            <span className="text-gray-700">Contraseña</span>
            <input type="password" className="mt-1 block w-full" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>

          <label className="block">
            <span className="text-gray-700">Rol</span>
            <select className="mt-1 block w-full" value={role} onChange={e => setRole(e.target.value as any)}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-gray-700">Clinic ID (opcional)</span>
            <input className="mt-1 block w-full" value={clinicId} onChange={e => setClinicId(e.target.value)} />
          </label>

          <div className="flex items-center space-x-2">
            <button type="submit" disabled={isSubmitting} className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded">
              {isSubmitting ? 'Creando...' : 'Crear Usuario'}
            </button>
            {message && <div className="text-sm text-gray-700">{message}</div>}
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminUsersPage;
