import { mockUsers } from './mockData';
import { type User } from '../types';

// Simulates logging in and getting a user profile
export const login = async (email: string): Promise<User | undefined> => {
  console.log(`Attempting to log in with email: ${email}`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  const user = mockUsers.find(u => u.email === email);
  if (user) {
    console.log('Login successful for:', user.name);
    localStorage.setItem('aynisalud_user_id', user.id);
    return user;
  }
  console.log('Login failed: user not found');
  return undefined;
};

export const getMe = async (): Promise<User | undefined> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const userId = localStorage.getItem('aynisalud_user_id');
  if (userId) {
    return mockUsers.find(u => u.id === userId);
  }
  return undefined;
}

export const logout = async (): Promise<void> => {
    localStorage.removeItem('aynisalud_user_id');
}
