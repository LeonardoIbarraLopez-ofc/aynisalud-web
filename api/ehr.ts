import { mockEHRs, mockPatients } from './mockData';
import { type EHR, type Patient } from '../types';

export const fetchEHRByPatientId = async (patientId: string): Promise<{ ehr?: EHR, patient?: Patient }> => {
  console.log(`Fetching EHR for patient ID: ${patientId}`);
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
  
  const ehr = mockEHRs.find(e => e.patientId === patientId);
  const patient = mockPatients.find(p => p.id === patientId);

  // For patients without a detailed mock EHR, create a default one
  if (!ehr && patient) {
      console.log('No specific EHR found, creating default for patient:', patient.firstName);
      const defaultEHR: EHR = {
          patientId: patient.id,
          snapshot: [
              ...(patient.allergies.map(a => ({ type: 'allergy' as const, title: a, details: 'Reacción desconocida.', isCritical: true }))),
              ...(patient.chronicConditions.map(c => ({ type: 'diagnosis' as const, title: c, details: 'Condición crónica.' })))
          ],
          timeline: []
      }
      return { ehr: defaultEHR, patient };
  }
  
  console.log('EHR data found:', ehr);
  return { ehr, patient };
};
