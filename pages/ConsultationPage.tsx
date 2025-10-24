import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAppointmentById } from '../api/appointments';
import { type Appointment } from '../types';
import EHRView from '../components/features/ehr/EHRView';
import { Spinner } from '../components/common/Spinner';

const ConsultationPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) {
      setError('No appointment ID provided.');
      setIsLoading(false);
      return;
    }

    const fetchAppointment = async () => {
      try {
        const data = await getAppointmentById(appointmentId);
        if (data) {
          setAppointment(data);
        } else {
          setError('Appointment not found.');
        }
      } catch (err) {
        setError('Failed to fetch appointment details.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAppointment();
  }, [appointmentId]);

  const handleConsultationEnd = () => {
    // Navigate back to the dashboard after the consultation is finalized
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-md">
        <h2 className="font-bold">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!appointment) {
    return <div>No appointment data available.</div>;
  }

  return (
    <div className="w-full h-full max-h-[calc(100vh-100px)] overflow-hidden">
      <EHRView 
        appointment={appointment} 
        onConsultationEnd={handleConsultationEnd}
      />
    </div>
  );
};

export default ConsultationPage;
