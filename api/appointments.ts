import { type Appointment, type AppointmentType, type Patient, type User } from '../types';
import { callBackendFunction } from './functionsClient';

const normalizePatient = (raw: any): Patient => ({
    id: String(raw?.id || raw?.patientId || raw?.uid || ''),
    firstName: String(raw?.firstName || ''),
    lastName: String(raw?.lastName || ''),
    dob: String(raw?.dob || ''),
    gender: raw?.gender === 'male' || raw?.gender === 'female' || raw?.gender === 'other' ? raw.gender : 'other',
    idNumber: String(raw?.idNumber || ''),
    contactInfo: {
        email: String(raw?.contactInfo?.email || ''),
        phone: String(raw?.contactInfo?.phone || ''),
        address: String(raw?.contactInfo?.address || ''),
    },
    insuranceInfo: Array.isArray(raw?.insuranceInfo) ? raw.insuranceInfo : [],
    allergies: Array.isArray(raw?.allergies) ? raw.allergies : [],
    chronicConditions: Array.isArray(raw?.chronicConditions) ? raw.chronicConditions : [],
    avatarUrl: raw?.avatarUrl || undefined,
});

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

const normalizeAppointmentType = (raw: any): AppointmentType => ({
    id: String(raw?.id || ''),
    name: String(raw?.name || ''),
    durationMinutes: Number.isFinite(raw?.durationMinutes) ? Number(raw.durationMinutes) : 30,
    price: Number.isFinite(raw?.price) ? Number(raw.price) : 0,
    description: String(raw?.description || ''),
});

export const normalizeAppointment = (raw: any): Appointment => {
    const start = raw?.startTime ? new Date(raw.startTime).toISOString() : new Date().toISOString();
    const end = raw?.endTime ? new Date(raw.endTime).toISOString() : start;
    const patientSnapshot = raw?.patient || raw?.patientSnapshot || {};
    const doctorSnapshot = raw?.doctor || raw?.doctorSnapshot || {};

    const patientId = String(
        raw?.patientId ||
        patientSnapshot?.id ||
        patientSnapshot?.patientId ||
        ''
    );
    const doctorId = String(raw?.doctorId || doctorSnapshot?.id || '');

    const normalizedPatient = normalizePatient({ patientId, ...patientSnapshot });
    const normalizedDoctor = normalizeUser({ id: doctorId, ...doctorSnapshot });

    return {
        id: String(raw?.id || ''),
        patient: normalizedPatient,
        patientId: patientId || undefined,
        doctor: normalizedDoctor,
        doctorId: doctorId || undefined,
        startTime: start,
        endTime: end,
        status: raw?.status || 'confirmed',
        type: normalizeAppointmentType(raw?.type || raw?.typeSnapshot || {}),
        checkinTime: raw?.checkinTime ? new Date(raw.checkinTime).toISOString() : undefined,
        notes: raw?.notes || undefined,
        associatedInvoiceId: raw?.associatedInvoiceId || undefined,
    };
};

export const fetchAppointmentsForToday = async (): Promise<Appointment[]> => {
    const result = await callBackendFunction<{ appointments?: any[] }>('listAgendaAppointments', { date: new Date().toISOString() });
    return (result.appointments || []).map(normalizeAppointment);
};

export const fetchAppointmentsForPatient = async (patientId: string): Promise<Appointment[]> => {
    const result = await callBackendFunction<{ appointments?: any[] }>('getAppointmentsForPatient', { patientId });
    return (result.appointments || []).map(normalizeAppointment);
};

export const getAppointmentById = async (appointmentId: string): Promise<Appointment | undefined> => {
    const result = await callBackendFunction<{ appointment?: any }>('getAppointmentById', { appointmentId });
    return result.appointment ? normalizeAppointment(result.appointment) : undefined;
};

export const updateAppointmentStatus = async (appointmentId: string, status: Appointment['status']): Promise<Appointment | undefined> => {
    const result = await callBackendFunction<{ appointment?: any }>('updateAppointmentStatus', { appointmentId, status });
    return result.appointment ? normalizeAppointment(result.appointment) : undefined;
};

export interface NewAppointmentData {
    patient: Patient;
    doctor: User;
    startTime: string;
    type: AppointmentType;
    notes?: string;
}

export const createAppointment = async (appointmentData: NewAppointmentData): Promise<Appointment> => {
    const payload = {
        patientId: appointmentData.patient.id,
        doctorId: appointmentData.doctor.id,
        typeId: appointmentData.type.id,
        startTime: appointmentData.startTime,
        notes: appointmentData.notes || null,
    };

    const result = await callBackendFunction<{ appointment?: any }>('createAppointment', payload);
    if (!result.appointment) {
        throw new Error('No se pudo crear la cita.');
    }
    return normalizeAppointment(result.appointment);
};
