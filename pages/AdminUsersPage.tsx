import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import { Spinner } from '../components/common/Spinner';
import ClinicalTimeline from '../components/features/ehr/ClinicalTimeline';
import ClinicalSnapshot from '../components/features/ehr/ClinicalSnapshot';
import { useDebounce } from '../hooks/useDebounce';
import { listUsers, adminUpdateUser, deleteUserAdmin, createUserAdmin, type AdminUpdateUserInput } from '../api/users';
import { fetchEHRByPatientId, type PatientEhrResponse } from '../api/ehr';
import { type User, type UserRole } from '../types';

const roles: UserRole[] = ['patient', 'doctor', 'specialist', 'receptionist', 'admin'];

const roleLabels: Record<UserRole, string> = {
  patient: 'Paciente',
  doctor: 'Doctor',
  specialist: 'Especialista',
  receptionist: 'Recepcionista',
  admin: 'Administrador',
};

const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  if (!password || password.length < 6) {
    errors.push('Debe tener al menos 6 caracteres.');
  }
  if (!/[A-Za-z]/.test(password)) {
    errors.push('Debe contener al menos una letra.');
  }
  if (!/\d/.test(password)) {
    errors.push('Debe contener al menos un número.');
  }
  return errors;
};

type EditFormState = {
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  clinicId: string;
  isActive: boolean;
  patientProfileId: string;
  password: string;
};

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (message: string) => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [clinicId, setClinicId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setEmail('');
      setPassword('');
      setRole('patient');
      setClinicId('');
      setIsSubmitting(false);
      setFormError(null);
    }
  }, [isOpen]);

  const passwordErrors = useMemo(() => (password ? validatePassword(password) : []), [password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validatePassword(password);
    if (errors.length > 0) {
      setFormError('La contraseña no cumple con los requisitos.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await createUserAdmin({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        role,
        clinicId: clinicId.trim() ? clinicId.trim() : undefined,
      });
      onCreated(`Usuario creado correctamente (uid: ${result?.uid ?? 'desconocido'})`);
      onClose();
    } catch (err: any) {
      console.error('createUserAdmin failed', err);
      setFormError(err?.message || 'No se pudo crear el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = isSubmitting || !email || !password || passwordErrors.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear nuevo usuario" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre</label>
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Nombre completo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="usuario@ejemplo.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contraseña</label>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
          {passwordErrors.length > 0 && (
            <div className="mt-2 rounded-md bg-red-100 p-3 text-sm text-red-700">
              <p className="font-semibold">La contraseña debe cumplir con:</p>
              <ul className="ml-4 list-disc space-y-1">
                {passwordErrors.map(error => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Rol</label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              value={role}
              onChange={event => setRole(event.target.value as UserRole)}
            >
              {roles.map(option => (
                <option key={option} value={option}>
                  {roleLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Clinic ID (opcional)</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              value={clinicId}
              onChange={event => setClinicId(event.target.value)}
              placeholder="ID de la clínica"
            />
          </div>
        </div>
        {formError && (
          <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{formError}</div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isSubmitting ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editState, setEditState] = useState<EditFormState | null>(null);
  const [isEditOpen, setEditOpen] = useState(false);
  const [isSavingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<PatientEhrResponse | null>(null);

  const debouncedSearch = useDebounce(search, 400);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listUsers({
        search: debouncedSearch || undefined,
        role: roleFilter,
      });
      setUsers(result);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar la lista de usuarios.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, roleFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    setCreateOpen(true);
    setFeedback(null);
  };

  const handleCreateSuccess = (message: string) => {
    setError(null);
    setFeedback(message);
    setCreateOpen(false);
    void loadUsers();
  };

  const handleOpenEdit = (user: User) => {
    setEditUser(user);
    setEditState({
      name: user.name || '',
      email: user.email || '',
      role: user.role,
      phone: user.phone || '',
      clinicId: user.clinicId || '',
      isActive: user.isActive,
      patientProfileId: user.patientProfileId || '',
      password: '',
    });
    setEditError(null);
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditUser(null);
    setEditState(null);
    setEditError(null);
  };

  const handleEditChange = <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
    setEditState(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const editPasswordErrors = useMemo(() => {
    if (!editState || !editState.password) return [];
    return validatePassword(editState.password);
  }, [editState?.password]);

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editUser || !editState) return;
    if (editState.password && editPasswordErrors.length > 0) {
      setEditError('La nueva contraseña no cumple con los requisitos.');
      return;
    }

    const updates: AdminUpdateUserInput = {};
    const trimmedName = editState.name.trim();
    if (trimmedName !== (editUser.name || '')) updates.name = trimmedName;

    const trimmedEmail = editState.email.trim();
    if (trimmedEmail !== (editUser.email || '')) updates.email = trimmedEmail;

    if (editState.role !== editUser.role) updates.role = editState.role;

    const trimmedPhone = editState.phone.trim();
    if (trimmedPhone !== (editUser.phone || '')) updates.phone = trimmedPhone || null;

    const trimmedClinicId = editState.clinicId.trim();
    if (trimmedClinicId !== (editUser.clinicId || '')) updates.clinicId = trimmedClinicId || null;

    if (editState.isActive !== editUser.isActive) updates.isActive = editState.isActive;

    const trimmedPatientProfileId = editState.patientProfileId.trim();
    if (trimmedPatientProfileId !== (editUser.patientProfileId || '')) {
      updates.patientProfileId = trimmedPatientProfileId || null;
    }

    if (editState.password) {
      updates.password = editState.password;
    }

    if (Object.keys(updates).length === 0) {
      setEditError('No hay cambios para guardar.');
      return;
    }

    setSavingEdit(true);
    try {
      await adminUpdateUser(editUser.id, updates);
      setError(null);
      setFeedback('Usuario actualizado correctamente.');
      handleCloseEdit();
      void loadUsers();
    } catch (err) {
      console.error(err);
      setEditError('No se pudo actualizar el usuario.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(`¿Eliminar al usuario ${user.name || user.email}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      await deleteUserAdmin(user.id);
      setError(null);
      setFeedback('Usuario eliminado correctamente.');
      void loadUsers();
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar el usuario.');
    }
  };

  const handleOpenHistory = (user: User) => {
    if (!user.patientProfileId) {
      setFeedback('El usuario no tiene un perfil de paciente asociado.');
      return;
    }

    setHistoryUser(user);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryData(null);

    void (async () => {
      try {
        const data = await fetchEHRByPatientId(user.patientProfileId as string);
        setHistoryData(data);
      } catch (err) {
        console.error(err);
        setHistoryError('No se pudo cargar el historial clínico.');
      } finally {
        setHistoryLoading(false);
      }
    })();
  };

  const handleCloseHistory = () => {
    setHistoryOpen(false);
    setHistoryUser(null);
    setHistoryData(null);
    setHistoryError(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gestión de Usuarios">
        <button
          onClick={handleOpenCreate}
          className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600"
        >
          + Nuevo usuario
        </button>
      </PageHeader>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Buscar</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                placeholder="Nombre, correo o clínica"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
            <div className="md:w-56">
              <label className="block text-sm font-medium text-gray-700">Rol</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                value={roleFilter}
                onChange={event => setRoleFilter(event.target.value as UserRole | 'all')}
              >
                <option value="all">Todos</option>
                {roles.map(option => (
                  <option key={option} value={option}>
                    {roleLabels[option]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {feedback && (
          <div className="mt-4 rounded-md bg-teal-50 p-3 text-sm text-teal-700">{feedback}</div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            {users.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                No se encontraron usuarios con los filtros aplicados.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rol</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Clínica</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="font-semibold text-gray-800">{user.name || '—'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {user.clinicId || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        {user.patientProfileId && (
                          <span className="ml-2 text-xs text-teal-600">Paciente vinculado</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleOpenHistory(user)}
                            disabled={!user.patientProfileId}
                            className="rounded-md border border-teal-500 px-3 py-1 text-xs font-semibold text-teal-600 hover:bg-teal-50 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                            title={user.patientProfileId ? 'Ver historial clínico' : 'Sin perfil de paciente vinculado'}
                          >
                            Historial
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="rounded-md border border-red-500 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreateSuccess}
      />

      <Modal
        isOpen={isEditOpen}
        onClose={handleCloseEdit}
        title={`Editar ${editUser?.name || editUser?.email || 'usuario'}`}
        size="lg"
      >
        {editUser && editState ? (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                  value={editState.name}
                  onChange={event => handleEditChange('name', event.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                  value={editState.email}
                  onChange={event => handleEditChange('email', event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Rol</label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                  value={editState.role}
                  onChange={event => handleEditChange('role', event.target.value as UserRole)}
                >
                  {roles.map(option => (
                    <option key={option} value={option}>
                      {roleLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                  value={editState.phone}
                  onChange={event => handleEditChange('phone', event.target.value)}
                  placeholder="Número de contacto"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Clinic ID</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                  value={editState.clinicId}
                  onChange={event => handleEditChange('clinicId', event.target.value)}
                  placeholder="ID de la clínica"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Perfil de paciente</label>
                <input
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                  value={editState.patientProfileId}
                  onChange={event => handleEditChange('patientProfileId', event.target.value)}
                  placeholder="ID del paciente vinculado"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                checked={editState.isActive}
                onChange={event => handleEditChange('isActive', event.target.checked)}
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">Activo</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Restablecer contraseña</label>
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
                value={editState.password}
                onChange={event => handleEditChange('password', event.target.value)}
                placeholder="Dejar vacío para mantener la contraseña actual"
              />
              {editPasswordErrors.length > 0 && (
                <div className="mt-2 rounded-md bg-red-100 p-3 text-sm text-red-700">
                  <p className="font-semibold">La contraseña debe cumplir con:</p>
                  <ul className="ml-4 list-disc space-y-1">
                    {editPasswordErrors.map(error => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {editError && (
              <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{editError}</div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || editPasswordErrors.length > 0}
                className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isHistoryOpen}
        onClose={handleCloseHistory}
        title={historyUser ? `Historial clínico de ${historyUser.name || historyUser.email}` : 'Historial clínico'}
        size="xl"
      >
        {historyLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : historyError ? (
          <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{historyError}</div>
        ) : historyData ? (
          <div className="grid h-[70vh] grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 overflow-hidden rounded-lg border">
              <ClinicalTimeline
                timeline={historyData.ehr.timeline}
                patientName={`${historyData.patient.firstName} ${historyData.patient.lastName}`}
              />
            </div>
            <div className="overflow-hidden rounded-lg border">
              <ClinicalSnapshot snapshot={historyData.ehr.snapshot} patient={historyData.patient} />
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-gray-500">
            Selecciona un paciente para visualizar su historial clínico.
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsersPage;


