// Represents a critical piece of information for the snapshot
export interface ClinicalSnapshotItem {
  type: 'diagnosis' | 'allergy' | 'medication' | 'vital' | 'note';
  title: string;
  details: string;
  isCritical?: boolean;
  date?: string;
  source?: string;
  tags?: string[];
}

export type ClinicalTimelineEventType =
  | 'ConsultationNote'
  | 'LabResult'
  | 'Prescription'
  | 'ImageStudy'
  | 'Procedure'
  | 'Vital'
  | 'Document';

// Represents an event in the patient's timeline
export interface ClinicalTimelineEvent {
  id: string;
  type: ClinicalTimelineEventType;
  date: string;
  title: string;
  summary: string;
  actor: string; // e.g., "Dr. Mendoza"
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface EhrStats {
  totalEvents: number;
  lastUpdated: string;
}

// Full EHR data for a patient
export interface EHR {
  patientId: string;
  snapshot: ClinicalSnapshotItem[];
  timeline: ClinicalTimelineEvent[];
  stats?: EhrStats;
}

export interface ConsultationNote {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  date: string; // ISO String
  subjective: string;
  objective: string;
  assessment: string; // This can contain diagnoses
  plan: string; // This can contain descriptions of prescriptions and orders
  isSigned: boolean;
  signatureTimestamp?: string;
}

export interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface LabOrder {
    id:string;
    testName: string;
    details: string;
}

export interface VitalSign {
  id: string;
  name: string;
  value: string;
  unit?: string;
}

export type TimelineEventTypeInput =
  | 'consultation_note'
  | 'clinical_note'
  | 'lab_result'
  | 'prescription'
  | 'imaging_study'
  | 'procedure'
  | 'vital_sign'
  | 'document';

export interface SoapNoteInput {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface AddEhrEventPayload {
  patientId: string;
  event: {
    type: TimelineEventTypeInput;
    title: string;
    summary?: string;
    details?: string;
    appointmentId?: string;
    performedAt?: string;
    status?: 'draft' | 'final' | 'signed';
    tags?: string[];
    soapNote?: SoapNoteInput;
    prescriptions?: Array<Partial<Prescription> & { medicationName: string }>;
    labOrders?: Array<Partial<LabOrder> & { testName: string }>;
    vitals?: Array<Partial<VitalSign> & { name: string; value: string }>;
  };
}
