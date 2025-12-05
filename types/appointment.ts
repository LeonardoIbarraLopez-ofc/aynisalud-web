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
  patientId?: string;
  doctor: User;
  doctorId?: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  status: AppointmentStatus;
  type: AppointmentType;
  checkinTime?: string; // ISO String, set when patient checks in
  notes?: string;
  associatedInvoiceId?: string;
}

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
}

export interface DoctorAvailability {
  doctorId: string;
  doctorName: string;
  clinicId?: string | null;
  slots: AvailabilitySlot[];
  professionalLicense?: string;
  specialties?: string[];
  languages?: string[];
  yearsExperience?: number;
  bio?: string;
  timezone?: string;
}

export interface AppointmentRequestInput {
  appointmentTypeId: string;
  doctorId: string;
  startTime: string;
  reason?: string;
  modality?: 'presencial' | 'virtual';
  notes?: string;
  contactPhone?: string;
  contactEmail?: string;
}
