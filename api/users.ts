import { mockUsers } from './mockData';
import { type User } from '../types';

export const getDoctors = async (): Promise<User[]> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockUsers.filter(u => u.role === 'doctor' || u.role === 'specialist');
};
