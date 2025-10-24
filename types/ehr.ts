// Represents a critical piece of information for the snapshot
export interface ClinicalSnapshotItem {
    type: 'diagnosis' | 'allergy' | 'medication' | 'vital' | 'note';
    title: string;
    details: string;
    isCritical?: boolean;
    date?: string;
}

// Represents an event in the patient's timeline
export interface ClinicalTimelineEvent {
    id: string;
    type: 'ConsultationNote' | 'LabResult' | 'Prescription' | 'ImageStudy' | 'Procedure';
    date: string;
    title: string;
    summary: string;
    actor: string; // e.g., "Dr. Mendoza"
}

// Full EHR data for a patient
export interface EHR {
    patientId: string;
    snapshot: ClinicalSnapshotItem[];
    timeline: ClinicalTimelineEvent[];
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
