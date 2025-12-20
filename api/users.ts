import { type User, type UserRole } from '../types';
import { callBackendFunction } from './functionsClient';

const normalizeUser = (raw: any): User => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || ''),
  email: String(raw?.email || ''),
  role: raw?.role || 'patient',
  avatarUrl: raw?.avatarUrl || undefined,
  phone: raw?.phone || undefined,
  isActive: raw?.isActive !== undefined ? !!raw.isActive : true,
  professionalLicense: raw?.professionalLicense ? String(raw.professionalLicense) : undefined,
  specialties: Array.isArray(raw?.specialties) ? raw.specialties.map((item: any) => String(item)) : [],
  languages: Array.isArray(raw?.languages) ? raw.languages.map((item: any) => String(item)) : [],
  yearsExperience: Number.isFinite(raw?.yearsExperience) ? Number(raw.yearsExperience) : undefined,
  bio: raw?.bio ? String(raw.bio) : undefined,
  patientProfileId: raw?.patientProfileId ? String(raw.patientProfileId) : undefined,
  clinicId: raw?.clinicId ? String(raw.clinicId) : undefined,
});

export const getDoctors = async (): Promise<User[]> => {
  try {
    const data = await callBackendFunction<{ doctors?: any[] }>('listPatientDoctors', {});
    return (data?.doctors || []).map(normalizeUser);
  } catch (err) {
    console.warn('[api/users] patient doctors endpoint unavailable, falling back', err);
    const data = await callBackendFunction<{ doctors?: any[] }>('listDoctors', {});
    return (data?.doctors || []).map(normalizeUser);
  }
};

export interface ListUsersParams {
  search?: string;
  role?: UserRole | 'all';
  limit?: number;
}

export const listUsers = async (params: ListUsersParams = {}): Promise<User[]> => {
  const payload: Record<string, unknown> = {};
  if (params.search) payload.search = params.search.trim();
  if (params.role && params.role !== 'all') payload.role = params.role;
  if (typeof params.limit === 'number') payload.limit = params.limit;

  const data = await callBackendFunction<{ users?: any[] }>('listUsers', payload);
  return (data?.users || []).map(normalizeUser);
};

export interface AdminUpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  phone?: string | null;
  clinicId?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  specialties?: string[];
  languages?: string[];
  yearsExperience?: number;
  bio?: string | null;
  patientProfileId?: string | null;
  password?: string;
}

export const adminUpdateUser = async (uid: string, updates: AdminUpdateUserInput): Promise<void> => {
  if (!uid) throw new Error('Missing uid');
  await callBackendFunction('adminUpdateUser', { uid, updates });
};

export const deleteUserAdmin = async (uid: string): Promise<void> => {
  if (!uid) throw new Error('Missing uid');
  await callBackendFunction('deleteUserAdmin', { uid });
};

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role: UserRole;
  clinicId?: string | null;
}

export const createUserAdmin = async (input: CreateUserInput): Promise<{ uid: string }> => {
  if (!input.email) throw new Error('Email requerido');
  if (!input.password) throw new Error('Password requerido');
  const payload: Record<string, unknown> = {
    email: input.email,
    password: input.password,
    role: input.role,
  };
  if (input.name) payload.name = input.name;
  if (input.clinicId) payload.clinicId = input.clinicId;

  const result = await callBackendFunction<{ uid: string }>('createUserAdmin', payload);
  return result;
};
