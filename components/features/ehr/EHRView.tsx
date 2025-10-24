import React, { useState, useEffect } from 'react';
import { fetchEHRByPatientId } from '../../../api/ehr';
import { type Appointment, type EHR, type Patient } from '../../../types';
import { Spinner } from '../../common/Spinner';
import ClinicalTimeline from './ClinicalTimeline';
import ClinicalNoteEditor from './ClinicalNoteEditor';
import ClinicalSnapshot from './ClinicalSnapshot';

interface EHRViewProps {
  appointment: Appointment;
  onConsultationEnd: () => void;
}

const EHRView: React.FC<EHRViewProps> = ({ appointment, onConsultationEnd }) => {
  const [ehrData, setEhrData] = useState<EHR | null>(null);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEHR = async () => {
      setIsLoading(true);
      try {
        const { ehr, patient } = await fetchEHRByPatientId(appointment.patient.id);
        if (ehr && patient) {
          setEhrData(ehr);
          setPatientData(patient);
        } else {
          setError('Could not find EHR data for this patient.');
        }
      } catch (err) {
        setError('An error occurred while loading patient records.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadEHR();
  }, [appointment.patient.id]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Spinner /></div>;
  }

  if (error || !ehrData || !patientData) {
    return <div className="p-4 bg-red-100 text-red-700 rounded-md">{error || 'EHR data is unavailable.'}</div>;
  }

  return (
    <div className="grid grid-cols-12 gap-4 bg-slate-50 p-4 h-full">
      {/* Col 1: Timeline */}
      <div className="col-span-3 h-full overflow-y-auto bg-white rounded-lg shadow-sm">
        <ClinicalTimeline timeline={ehrData.timeline} patientName={`${patientData.firstName} ${patientData.lastName}`} />
      </div>

      {/* Col 2: Main Content (Note Editor) */}
      <div className="col-span-6 h-full overflow-y-auto bg-white rounded-lg shadow-sm">
        <ClinicalNoteEditor 
            appointment={appointment} 
            patient={patientData}
            onFinalize={onConsultationEnd} 
        />
      </div>

      {/* Col 3: Snapshot */}
      <div className="col-span-3 h-full overflow-y-auto bg-white rounded-lg shadow-sm">
        <ClinicalSnapshot snapshot={ehrData.snapshot} patient={patientData} />
      </div>
    </div>
  );
};

export default EHRView;
