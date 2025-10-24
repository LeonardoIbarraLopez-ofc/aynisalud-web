export type UserRole = 'admin' | 'doctor' | 'receptionist' | 'specialist' | 'patient';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  isActive: boolean;
}
