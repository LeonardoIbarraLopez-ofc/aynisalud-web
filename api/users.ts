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
});

export const getDoctors = async (): Promise<User[]> => {
  const data = await callBackendFunction<{ doctors?: any[] }>('listDoctors', {});
  return (data?.doctors || []).map(normalizeUser);
};
