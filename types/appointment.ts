import { type Patient } from './patient';
import { type User } from './user';

export type AppointmentStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'attended_pending_payment'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string;
}

export interface Appointment {
  id: string;
  patient: Patient;
  doctor: User;
  startTime: string; // ISO String
  endTime: string; // ISO String
  status: AppointmentStatus;
  type: AppointmentType;
  checkinTime?: string; // ISO String, set when patient checks in
  notes?: string;
  associatedInvoiceId?: string;
}
