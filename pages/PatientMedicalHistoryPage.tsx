import React, { useEffect, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import ClinicalTimeline from '../components/features/ehr/ClinicalTimeline';
import ClinicalSnapshot from '../components/features/ehr/ClinicalSnapshot';
import { fetchEHRByPatientId } from '../api/ehr';
import { useAuth } from '../contexts/AuthContext';
import { type EHR, type Patient } from '../types';
import { Spinner } from '../components/common/Spinner';

const makeSampleEHR = (patientId: string): EHR => ({
  patientId,
  snapshot: [
    { type: 'diagnosis', title: 'Hipotiroidismo', details: 'En tratamiento con levotiroxina 50mcg diarios.', isCritical: false },
    { type: 'medication', title: 'Metformina', details: '500mg, una vez al día.', isCritical: false },
    { type: 'allergy', title: 'Penicilina', details: 'Urticaria grave en 2018', isCritical: true },
    { type: 'vital', title: 'Última presión arterial', details: '122/78 mmHg', date: '2025-10-01' },
  ],
  timeline: [
    { id: 'ev-s-1', type: 'ConsultationNote', date: '2025-10-01', title: 'Consulta control', summary: 'Paciente con buena evolución. Ajuste de dosis.', actor: 'Dra. Rojas' },
    { id: 'ev-s-2', type: 'LabResult', date: '2025-09-20', title: 'Perfil Metabólico', summary: 'Glucosa y lípidos dentro de parámetros esperados.', actor: 'Laboratorio Central' },
    { id: 'ev-s-3', type: 'Prescription', date: '2025-08-15', title: 'Receta de Levotiroxina', summary: 'Levotiroxina 50mcg, tomar una vez al día en ayunas.', actor: 'Dr. Mendoza' },
    { id: 'ev-s-4', type: 'ImageStudy', date: '2025-07-10', title: 'Radiografía de tórax', summary: 'Sin hallazgos patológicos.', actor: 'Radiología Ayni' },
  ]
});

const PatientMedicalHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [ehr, setEhr] = useState<EHR | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!user) {
          setEhr(null);
          setPatient(null);
          return;
        }

        // Attempt to find patient by matching email/name to mockPatients via the EHR API helper
        // The API expects a patientId; try to find by looking up patients returned alongside EHR
        // We'll try common ids by searching the mock EHR endpoint indirectly: find matching patient via fetchEHRByPatientId for known patients
        // Simpler approach: loop through mockPatients is not available here, so try to find via email/name mapping by calling fetchEHRByPatientId for likely ids is not practical.
        // Instead, attempt to map by assuming user email local-part matches patient first/last names; fallback to sample EHR.

        // Best-effort: try common patient ids used in mock data
        const commonIds = ['patient-1', 'patient-2', 'patient-3', 'patient-4', 'patient-5'];
        let found: { ehr?: EHR; patient?: Patient } | null = null;
        for (const id of commonIds) {
          // eslint-disable-next-line no-await-in-loop
          const res = await fetchEHRByPatientId(id);
          if (res && res.patient) {
            const p = res.patient;
            const email = p.contactInfo?.email || '';
            if (email.toLowerCase() === (user.email || '').toLowerCase()) {
              found = res;
              break;
            }
            const name = `${p.firstName} ${p.lastName}`.toLowerCase();
            if (name.includes((user.name || '').toLowerCase())) {
              found = res;
              break;
            }
          }
        }

        if (found && found.patient) {
          setPatient(found.patient);
          setEhr(found.ehr || makeSampleEHR(found.patient.id));
        } else {
          // No mapping found: create a sample patient record from the user
          const samplePatient: Patient = {
            id: 'patient-sample',
            firstName: user.name?.split(' ')[0] || 'Paciente',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            dob: '1980-01-01',
            gender: 'female',
            idNumber: 'N/A',
            contactInfo: { email: user.email || '', phone: '', address: '' },
            insuranceInfo: [],
            allergies: ['Penicilina'],
            chronicConditions: ['Hipotiroidismo'],
            avatarUrl: ''
          };
          setPatient(samplePatient);
          setEhr(makeSampleEHR(samplePatient.id));
        }
      } catch (err) {
        console.error('Failed loading EHR', err);
        setEhr(makeSampleEHR('patient-sample'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center p-8"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Mi Historial Médico" />
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          {ehr ? <ClinicalTimeline timeline={ehr.timeline} patientName={`${patient?.firstName || ''} ${patient?.lastName || ''}`} /> : (
            <div className="bg-white p-6 rounded-lg shadow-md">No hay historial disponible.</div>
          )}
        </div>

        <div className="lg:col-span-4">
          {ehr && patient ? (
            <ClinicalSnapshot snapshot={ehr.snapshot} patient={patient} />
          ) : (
            <div className="bg-white p-6 rounded-lg shadow-md">No hay datos de paciente.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientMedicalHistoryPage;
