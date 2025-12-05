import { callBackendFunction } from './functionsClient';
import { normalizeAppointment } from './appointments';
import { normalizeInvoice } from './billing';
import { type DoctorAvailability, type AvailabilitySlot, type AppointmentRequestInput, type Appointment, type Invoice } from '../types';

const mapAvailability = (raw: any): DoctorAvailability => ({
  doctorId: String(raw?.doctorId || ''),
  doctorName: String(raw?.doctorName || ''),
  clinicId: raw?.clinicId || null,
  slots: Array.isArray(raw?.slots)
    ? raw.slots.map((slot: any): AvailabilitySlot => ({
        startTime: new Date(slot?.startTime || Date.now()).toISOString(),
        endTime: new Date(slot?.endTime || Date.now()).toISOString(),
      }))
    : [],
  professionalLicense: raw?.professionalLicense ? String(raw.professionalLicense) : undefined,
  specialties: Array.isArray(raw?.specialties) ? raw.specialties.map((item: any) => String(item)) : [],
  languages: Array.isArray(raw?.languages) ? raw.languages.map((item: any) => String(item)) : [],
  yearsExperience: Number.isFinite(raw?.yearsExperience) ? Number(raw.yearsExperience) : undefined,
  bio: raw?.bio ? String(raw.bio) : undefined,
  timezone: raw?.timezone ? String(raw.timezone) : undefined,
});

export const getAvailabilityForDate = async (
  params: {
    date: string;
    appointmentTypeId: string;
    doctorId?: string;
  },
): Promise<DoctorAvailability[]> => {
  const result = await callBackendFunction<{ availability?: any[] }>('getPatientAvailability', params);
  const availability = (result.availability || []).map(mapAvailability);
  return availability;
};

export const requestAppointment = async (
  payload: AppointmentRequestInput,
): Promise<{ appointmentId: string; appointment?: Appointment; invoice?: Invoice }> => {
  const result = await callBackendFunction<{
    appointmentId: string;
    doctorId: string;
    startTime: string;
    endTime: string;
    appointment?: any;
    invoice?: any;
  }>('requestAppointment', payload);

  const appointment = result.appointment ? normalizeAppointment(result.appointment) : undefined;
  const invoice = result.invoice ? normalizeInvoice(result.invoice) : undefined;

  return {
    appointmentId: result.appointmentId,
    appointment,
    invoice,
  };
};
