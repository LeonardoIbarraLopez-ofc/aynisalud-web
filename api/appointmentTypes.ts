import { type AppointmentType } from '../types';
import { callBackendFunction } from './functionsClient';

const normalizeAppointmentType = (raw: any): AppointmentType => ({
    id: String(raw?.id || ''),
    name: String(raw?.name || ''),
    durationMinutes: Number.isFinite(raw?.durationMinutes) ? Number(raw.durationMinutes) : 30,
    price: Number.isFinite(raw?.price) ? Number(raw.price) : 0,
    description: String(raw?.description || ''),
});

export const getAppointmentTypes = async (): Promise<AppointmentType[]> => {
    try {
        const data = await callBackendFunction<{ appointmentTypes?: any[] }>('listPatientAppointmentTypes', {});
        return (data?.appointmentTypes || []).map(normalizeAppointmentType);
    } catch (err) {
        console.warn('[api/appointmentTypes] patient endpoint unavailable, falling back', err);
        const data = await callBackendFunction<{ appointmentTypes?: any[] }>('listAppointmentTypes', {});
        return (data?.appointmentTypes || []).map(normalizeAppointmentType);
    }
};