import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchAppointmentsForToday, updateAppointmentStatus as apiUpdateStatus } from '../../../api/appointments';
import { type Appointment } from '../../../types';
import { Spinner } from '../../common/Spinner';
import AppointmentCard from './AppointmentCard';
import CheckoutModal from '../billing/CheckoutModal';

interface AgendaDayViewProps {
    isWidget?: boolean;
    refreshTrigger?: number;
    filters?: {
        doctorId: string;
        status: string;
    }
}

const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 18;

const CurrentTimeIndicator: React.FC<{ containerRef: React.RefObject<HTMLDivElement> }> = ({ containerRef }) => {
    const [topPosition, setTopPosition] = useState(0);

    const calculatePosition = useCallback(() => {
        if (!containerRef.current) return;

        const now = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

        const totalMinutesInDay = (WORK_DAY_END_HOUR - WORK_DAY_START_HOUR) * 60;
        const minutesFromStart = (now.getTime() - startOfDay.getTime()) / 60000;
        
        const percentage = Math.max(0, Math.min(100, (minutesFromStart / totalMinutesInDay) * 100));
        
        const containerHeight = containerRef.current.scrollHeight;
        setTopPosition((containerHeight * percentage) / 100);

    }, [containerRef]);

    useEffect(() => {
        calculatePosition();
        const interval = setInterval(calculatePosition, 60000); // Update every minute
        window.addEventListener('resize', calculatePosition);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', calculatePosition);
        }
    }, [calculatePosition]);

    if (topPosition === 0) return null;

    return (
        <div className="absolute left-0 right-0 h-0.5 bg-red-500 z-10" style={{ top: `${topPosition}px` }}>
            <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-red-500 rounded-full"></div>
        </div>
    );
};


const AgendaDayView: React.FC<AgendaDayViewProps> = ({ isWidget = false, refreshTrigger = 0, filters }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update time every minute
      return () => clearInterval(timer);
  }, []);

  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchAppointmentsForToday();
      data.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setAppointments(data);
    // FIX: Corrected a syntax error in the catch block which caused all subsequent errors.
    } catch (err) {
      setError('Failed to fetch appointments.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments, refreshTrigger]);
  
  const filteredAppointments = useMemo(() => {
    if (!filters) return appointments;
    return appointments.filter(apt => {
        const doctorMatch = filters.doctorId === 'all' || apt.doctor.id === filters.doctorId;
        const statusMatch = filters.status === 'all' || apt.status === filters.status;
        return doctorMatch && statusMatch;
    });
  }, [appointments, filters]);

  const handleUpdateStatus = async (id: string, status: Appointment['status']) => {
    const originalAppointments = [...appointments];
    const updatedAppointments = appointments.map(apt => 
        apt.id === id ? { ...apt, status, ...(status === 'checked_in' && { checkinTime: new Date().toISOString() }) } : apt
    );
    setAppointments(updatedAppointments);

    try {
        await apiUpdateStatus(id, status);
        fetchAppointments(); // Re-fetch to get server-confirmed data
    } catch (error) {
        setAppointments(originalAppointments);
        alert(`Failed to update status for appointment ${id}`);
    }
  }

  const handleCheckoutComplete = () => {
    setCheckoutAppointment(null);
    fetchAppointments();
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 min-h-[200px]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 bg-red-100 p-4 rounded-md">{error}</div>;
  }
  
  const containerClass = isWidget ? "bg-white rounded-lg shadow-md" : "";
  const titleClass = isWidget ? "text-xl font-semibold text-gray-700 p-6 border-b" : "hidden";

  return (
    <div className={containerClass}>
        <h3 className={titleClass}>Agenda del Día</h3>
        <div className="space-y-4 p-4 relative" ref={containerRef}>
        {!isWidget && <CurrentTimeIndicator containerRef={containerRef} />}
        {filteredAppointments.length > 0 ? (
            filteredAppointments.map((apt) => <AppointmentCard key={apt.id} appointment={apt} onUpdateStatus={handleUpdateStatus} currentTime={currentTime} onStartCheckout={setCheckoutAppointment} />)
        ) : (
            <p className="text-gray-500 text-center py-8">No hay citas programadas para hoy.</p>
        )}
        </div>

        {checkoutAppointment && (
            <CheckoutModal 
                isOpen={!!checkoutAppointment}
                onClose={() => setCheckoutAppointment(null)}
                appointment={checkoutAppointment}
                onCheckoutComplete={handleCheckoutComplete}
            />
        )}
    </div>
  );
};

export default AgendaDayView;