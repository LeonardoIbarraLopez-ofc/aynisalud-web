import { callBackendFunction } from './functionsClient';
import {
    type AddEhrEventPayload,
    type ClinicalSnapshotItem,
    type ClinicalTimelineEvent,
    type ConsultationDocument,
    type EHR,
    type EhrStats,
    type LabOrder,
    type LabResult,
    type Patient,
    type Prescription,
    type VitalSign,
} from '../types';

const generateLocalId = (prefix: string): string => {
    const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
    if (hasCrypto) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

const normalizePatient = (raw: any): Patient => ({
    id: String(raw?.id || raw?.patientId || ''),
    firstName: String(raw?.firstName || ''),
    lastName: String(raw?.lastName || ''),
    dob: String(raw?.dob || ''),
    gender: ['male', 'female', 'other'].includes(String(raw?.gender)) ? raw.gender : 'other',
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

const normalizeSnapshotItem = (raw: any): ClinicalSnapshotItem => ({
    type: ['diagnosis', 'allergy', 'medication', 'vital', 'note'].includes(String(raw?.type))
        ? raw.type
        : 'note',
    title: String(raw?.title || ''),
    details: String(raw?.details || ''),
    isCritical: !!raw?.isCritical,
    date: raw?.date ? new Date(raw.date).toISOString() : undefined,
    source: raw?.source ? String(raw.source) : undefined,
    tags: Array.isArray(raw?.tags) ? raw.tags.map((tag: any) => String(tag)) : undefined,
});

const normalizePrescription = (raw: any): Prescription => ({
    id: String(raw?.id || generateLocalId('prescription')),
    medicationName: String(raw?.medicationName || ''),
    dosage: raw?.dosage ? String(raw.dosage) : '',
    frequency: raw?.frequency ? String(raw.frequency) : '',
    duration: raw?.duration ? String(raw.duration) : '',
});

const normalizeLabOrder = (raw: any): LabOrder => ({
    id: String(raw?.id || generateLocalId('lab-order')),
    testName: String(raw?.testName || ''),
    details: raw?.details ? String(raw.details) : '',
});

const normalizeLabResult = (raw: any): LabResult => ({
    id: String(raw?.id || generateLocalId('lab-result')),
    testName: String(raw?.testName || ''),
    resultValue: raw?.resultValue ? String(raw.resultValue) : undefined,
    unit: raw?.unit ? String(raw.unit) : undefined,
    referenceRange: raw?.referenceRange ? String(raw.referenceRange) : undefined,
    interpretation: raw?.interpretation ? String(raw.interpretation) : undefined,
    notes: raw?.notes ? String(raw.notes) : undefined,
});

const normalizeDocument = (raw: any): ConsultationDocument => ({
    id: String(raw?.id || generateLocalId('doc')),
    title: String(raw?.title || ''),
    url: raw?.url ? String(raw.url) : undefined,
    description: raw?.description ? String(raw.description) : undefined,
    type: raw?.type ? String(raw.type) : undefined,
});

const normalizeTimelineMetadata = (rawMeta: any = {}): Record<string, unknown> | undefined => {
    if (!rawMeta || typeof rawMeta !== 'object') return undefined;
    const metadata: Record<string, unknown> = { ...rawMeta };
    if (Array.isArray(rawMeta.prescriptions)) {
        metadata.prescriptions = rawMeta.prescriptions.map(normalizePrescription);
    }
    if (Array.isArray(rawMeta.labOrders)) {
        metadata.labOrders = rawMeta.labOrders.map(normalizeLabOrder);
    }
    if (Array.isArray(rawMeta.labResults)) {
        metadata.labResults = rawMeta.labResults.map(normalizeLabResult);
    }
    if (Array.isArray(rawMeta.attachments)) {
        metadata.attachments = rawMeta.attachments.map(normalizeDocument);
    }
    return metadata;
};

const normalizeTimelineEvent = (raw: any): ClinicalTimelineEvent => ({
    id: String(raw?.id || ''),
    type: ['ConsultationNote', 'LabResult', 'Prescription', 'ImageStudy', 'Procedure', 'Vital', 'Document'].includes(
        String(raw?.type),
    )
        ? raw.type
        : 'ConsultationNote',
    date: raw?.date ? new Date(raw.date).toISOString() : new Date().toISOString(),
    title: String(raw?.title || 'Registro clínico'),
    summary: String(raw?.summary || ''),
    actor: String(raw?.actor || 'Profesional de salud'),
    tags: Array.isArray(raw?.tags) ? raw.tags.map((tag: any) => String(tag)) : undefined,
    metadata: normalizeTimelineMetadata(raw?.metadata),
});

const normalizeStats = (raw: any | undefined): EhrStats | undefined => {
    if (!raw) return undefined;
    const totalEvents = Number.isFinite(raw.totalEvents) ? Number(raw.totalEvents) : 0;
    const lastUpdated = raw.lastUpdated ? new Date(raw.lastUpdated).toISOString() : new Date().toISOString();
    return { totalEvents, lastUpdated };
};

export interface PatientEhrResponse {
    ehr: EHR;
    patient: Patient;
}

const buildPatientEhrResponse = (raw: any, fallbackPatientId?: string): PatientEhrResponse => {
    if (!raw) {
        throw new Error('Respuesta vacía del backend de EHR');
    }

    const patient = normalizePatient(raw.patient || {});
    const snapshot = Array.isArray(raw.snapshot) ? raw.snapshot.map(normalizeSnapshotItem) : [];
    const timeline = Array.isArray(raw.timeline) ? raw.timeline.map(normalizeTimelineEvent) : [];
    const stats = normalizeStats(raw.stats);

    const ehr: EHR = {
        patientId: String(raw.patientId || fallbackPatientId || patient.id),
        snapshot,
        timeline,
        stats,
    };

    return { ehr, patient };
};

export const fetchEHRByPatientId = async (patientId: string): Promise<PatientEhrResponse> => {
    if (!patientId) {
        throw new Error('patientId requerido');
    }

    const response = await callBackendFunction<any>('getPatientEhr', { patientId });
    return buildPatientEhrResponse(response, patientId);
};

export const fetchMyEhr = async (): Promise<PatientEhrResponse> => {
    const response = await callBackendFunction<any>('getPatientEhr', {});
    return buildPatientEhrResponse(response);
};

type PartialPrescription = Partial<Prescription> & { medicationName: string };
type PartialLabOrder = Partial<LabOrder> & { testName: string };
type PartialLabResult = Partial<LabResult> & { testName: string };
type PartialDocument = Partial<ConsultationDocument> & { title: string };
type PartialVital = Partial<VitalSign> & { name: string; value: string };

export interface CreateConsultationNoteInput {
    patientId: string;
    appointmentId?: string;
    status?: 'draft' | 'final' | 'signed';
    title?: string;
    summary?: string;
    soapNote?: AddEhrEventPayload['event']['soapNote'];
    prescriptions?: PartialPrescription[];
    labOrders?: PartialLabOrder[];
    labResults?: PartialLabResult[];
    documents?: PartialDocument[];
    vitals?: PartialVital[];
    tags?: string[];
    performedAt?: string;
}

export const addEhrEvent = async (payload: AddEhrEventPayload): Promise<{ eventId: string; patientId: string }> => {
    if (!payload.patientId) {
        throw new Error('patientId requerido');
    }
    if (!payload.event?.type) {
        throw new Error('El tipo de evento es obligatorio');
    }

    const result = await callBackendFunction<{ eventId: string; patientId: string }>('addEhrEvent', payload);
    if (!result?.eventId) {
        throw new Error('No se pudo registrar el evento clínico');
    }
    return result;
};

export const createConsultationNote = async (
    input: CreateConsultationNoteInput,
): Promise<{ eventId: string; patientId: string }> => {
    const {
        patientId,
        appointmentId,
        status = 'final',
        title,
        summary,
        soapNote,
        prescriptions,
        labOrders,
        labResults,
        documents,
        vitals,
        tags,
        performedAt,
    } = input;

    const eventPayload: AddEhrEventPayload = {
        patientId,
        event: {
            type: 'consultation_note',
            title: title || 'Nota de consulta',
            summary: summary || '',
            appointmentId,
            status,
            soapNote,
            prescriptions,
            labOrders,
            labResults,
            documents,
            vitals,
            tags,
            performedAt,
        },
    };

    return addEhrEvent(eventPayload);
};
