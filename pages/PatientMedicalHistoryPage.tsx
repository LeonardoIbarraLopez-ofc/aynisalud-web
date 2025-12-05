import React, { useEffect, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import ClinicalTimeline from '../components/features/ehr/ClinicalTimeline';
import ClinicalSnapshot from '../components/features/ehr/ClinicalSnapshot';
import { fetchEHRByPatientId, fetchMyEhr } from '../api/ehr';
import { useAuth } from '../contexts/AuthContext';
import { type EHR, type Patient } from '../types';
import { Spinner } from '../components/common/Spinner';

const PatientMedicalHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [ehr, setEhr] = useState<EHR | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user) {
          setEhr(null);
          setPatient(null);
          setError('Debes iniciar sesión para ver tu historial.');
          return;
        }

        const candidateIds: string[] = [];
        if (user.patientProfileId) candidateIds.push(user.patientProfileId);
        if (user.id) candidateIds.push(user.id);

        let found: { ehr: EHR; patient: Patient } | null = null;
        let lastError: unknown = null;

        for (const candidateId of candidateIds) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const response = await fetchEHRByPatientId(candidateId);
            found = response;
            break;
          } catch (err) {
            lastError = err;
          }
        }

        if (!found && user.role === 'patient') {
          try {
            found = await fetchMyEhr();
          } catch (err) {
            lastError = err;
          }
        }

        if (!found) {
          console.warn('No se pudo cargar el EHR del paciente', lastError);
          setEhr(null);
          setPatient(null);
          setError('No pudimos encontrar registros clínicos vinculados a tu cuenta.');
          return;
        }

        setPatient(found.patient);
        setEhr(found.ehr);
      } catch (err) {
        console.error('Failed loading EHR', err);
        setEhr(null);
        setPatient(null);
        setError('Ocurrió un error al cargar tu historial clínico.');
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
      {error && (
        <div className="mt-4 bg-red-100 text-red-700 p-4 rounded-md">
          {error}
        </div>
      )}
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
