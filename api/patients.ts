import { type Patient, type QuickPatientInput } from '../types';
import { callBackendFunction } from './functionsClient';

export const normalizePatient = (raw: any): Patient => ({
    id: String(raw?.id || ''),
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

export const searchPatients = async (query: string): Promise<Patient[]> => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    try {
        const result = await callBackendFunction<{ patients?: any[] }>('searchPatients', { query: trimmed });
        const normalized = (result.patients || []).map(normalizePatient);
        console.debug('[api/searchPatients] query', trimmed, 'returned', normalized.length, 'patients');
        return normalized;
    } catch (err) {
        console.error('[api/searchPatients] failed for', trimmed, err);
        throw err;
    }
};

export const createQuickPatient = async (patientData: QuickPatientInput): Promise<Patient> => {
    const result = await callBackendFunction<{ patient?: any }>('createQuickPatient', patientData);
    if (!result.patient) {
        throw new Error('No se pudo crear el paciente.');
    }
    return normalizePatient(result.patient);
};