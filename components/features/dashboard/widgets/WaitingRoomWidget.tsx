import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAppointmentsForToday } from '../../../../api/appointments';
import { type Appointment } from '../../../../types';
import { Spinner } from '../../../common/Spinner';
import Card from '../../../common/Card';

const WaitingRoomWidget: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchAppointments = useCallback(async () => {
        try {
            // No need to set loading to true on refetch
            const data = await fetchAppointmentsForToday();
            setAppointments(data);
        } catch (err) {
            setError('Failed to fetch appointments.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
        const dataRefreshInterval = setInterval(fetchAppointments, 60000); // Re-fetch data every minute
        const timerInterval = setInterval(() => setCurrentTime(new Date()), 1000); // Update time every second for timer
        
        return () => {
            clearInterval(dataRefreshInterval);
            clearInterval(timerInterval);
        };
    }, [fetchAppointments]);

    const waitingPatients = useMemo(() => {
        return appointments
            .filter(apt => apt.status === 'checked_in')
            .sort((a, b) => new Date(a.checkinTime!).getTime() - new Date(b.checkinTime!).getTime());
    }, [appointments]);

    const formatWaitTime = (checkinTime: string): { text: string, color: string } => {
        const diffMs = currentTime.getTime() - new Date(checkinTime).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        const color = diffMins >= 15 ? 'text-red-600' : diffMins >= 10 ? 'text-yellow-600' : 'text-green-600';
        return {
            text: `${String(diffMins).padStart(2, '0')}:${String(diffSecs).padStart(2, '0')}`,
            color
        };
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center py-4"><Spinner /></div>;
        }
        if (error) {
            return <p className="text-red-500 text-sm">{error}</p>;
        }
        if (waitingPatients.length === 0) {
            return <div className="text-center py-4"><p className="text-gray-500">Actualmente vacía</p></div>;
        }

        return (
            <div className="space-y-3">
                {waitingPatients.map(apt => {
                    const { text, color } = formatWaitTime(apt.checkinTime!);
                    return (
                        <div key={apt.id} className="flex justify-between items-center">
                            <div className="flex-grow">
                                <p className="font-semibold text-gray-800">{apt.patient.firstName} {apt.patient.lastName}</p>
                                <p className="text-sm text-gray-500">{apt.type.name}</p>
                                <p className="text-sm text-gray-500">con {apt.doctor.name}</p>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className={`text-lg font-bold ${color}`}>{text}</div>
                                <button 
                                    onClick={() => alert(`Notificando a ${apt.doctor.name} sobre la espera de ${apt.patient.firstName}.`)}
                                    title="Notificar al doctor"
                                    className="text-gray-400 hover:text-teal-500 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }


    return (
        <Card title="Sala de Espera">
            {renderContent()}
        </Card>
    );
};

export default WaitingRoomWidget;