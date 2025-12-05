import { type Patient } from './patient';
import { type Appointment } from './appointment';
import { type Invoice } from './billing';

export interface PatientPortalOverview {
  patient: Patient;
  upcomingAppointments: Appointment[];
  pendingInvoices: Invoice[];
  recentInvoices: Invoice[];
}
