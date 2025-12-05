import { type User } from '../types';
import { callBackendFunction } from './functionsClient';

const normalizeUser = (raw: any): User => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || ''),
  email: String(raw?.email || ''),
  role: raw?.role || 'doctor',
  avatarUrl: raw?.avatarUrl || undefined,
  phone: raw?.phone || undefined,
  isActive: raw?.isActive !== undefined ? !!raw.isActive : true,
  professionalLicense: raw?.professionalLicense ? String(raw.professionalLicense) : undefined,
  specialties: Array.isArray(raw?.specialties) ? raw.specialties.map((item: any) => String(item)) : [],
  languages: Array.isArray(raw?.languages) ? raw.languages.map((item: any) => String(item)) : [],
  yearsExperience: Number.isFinite(raw?.yearsExperience) ? Number(raw.yearsExperience) : undefined,
  bio: raw?.bio ? String(raw.bio) : undefined,
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
