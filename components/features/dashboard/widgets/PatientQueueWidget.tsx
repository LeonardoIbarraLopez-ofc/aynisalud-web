import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAppointmentsForToday } from '../../../../api/appointments';
import { useAuth } from '../../../../contexts/AuthContext';
import { type Appointment } from '../../../../types';
import { Spinner } from '../../../common/Spinner';
import Card from '../../../common/Card';
import Tooltip from '../../../common/Tooltip';

const statusStyles: { [key in Appointment['status']]: { bg: string, text: string, border: string, label: string } } = {
    pending_confirmation: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400', label: 'Pendiente' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400', label: 'Próximo' },
    checked_in: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400', label: 'En Sala de Espera' },
    in_progress: { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-700', label: 'En Consulta' },
    attended_pending_payment: { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-400', label: 'Pendiente de Cierre' },
    completed: { bg: 'bg-slate-200', text: 'text-slate-600', border: 'border-slate-400', label: 'Completado' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-400', label: 'Cancelada' },
    no_show: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-400', label: 'No se presentó' }
};

const PatientQueueCard: React.FC<{ appointment: Appointment, currentTime: Date }> = ({ appointment, currentTime }) => {
    const navigate = useNavigate();
    const { patient, startTime, type, checkinTime, status } = appointment;
    const style = statusStyles[status];

    const getWaitTime = () => {
      if(status !== 'checked_in' || !checkinTime) return null;
      const diffMs = currentTime.getTime() - new Date(checkinTime).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      const color = diffMins > 15 ? 'text-red-600' : diffMins > 10 ? 'text-yellow-600' : 'text-green-600';
      return <span className={`font-bold text-sm ${color}`}>Esperando {String(diffMins).padStart(2, '0')}:{String(diffSecs).padStart(2, '0')}</span>
    };

    const handleCallPatient = () => {
        navigate(`/consulta/${appointment.id}`);
    };

    const isActionable = ['confirmed', 'checked_in'].includes(status);

    return (
        <div className={`p-4 rounded-lg border-l-4 flex items-center justify-between transition-shadow hover:shadow-md relative group ${style.bg} ${style.border} ${status === 'in_progress' ? 'shadow-lg scale-[1.02] transition-transform' : ''}`}>
            <div className="flex items-center">
                <div className="text-center w-20 mr-4">
                    <p className="text-lg font-bold text-gray-800">{new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                    <p className="text-sm text-gray-500">{type.durationMinutes} min</p>
                </div>
                <div>
                    <p className="font-bold text-lg text-gray-900">{patient.firstName} {patient.lastName}</p>
                    <p className="text-sm text-gray-600 font-medium">{appointment.notes || type.name}</p>
                </div>
            </div>
            <div className="flex items-center space-x-4">
                <div className="text-right">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text}`}>{style.label}</span>
                     {status === 'checked_in' && <div className="mt-1">{getWaitTime()}</div>}
                </div>
                <div className="w-40 text-right">
                    {isActionable && (
                        <Tooltip content={
                            <div>
                                <p className="font-bold">Motivo:</p>
                                <p>{appointment.notes}</p>
                                <p className="mt-2 font-bold">Último diagnóstico:</p>
                                <p>{patient.chronicConditions[0] || 'N/A'}</p>
                            </div>
                        }>
                             <button
                                onClick={handleCallPatient}
                                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow transition-transform transform hover:scale-105"
                            >
                                Llamar
                            </button>
                        </Tooltip>
                    )}
                     {status === 'in_progress' && (
                         <button
                            onClick={handleCallPatient}
                            className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow animate-pulse"
                        >
                            Continuar
                        </button>
                     )}
                     {status === 'attended_pending_payment' && (
                         <button
                            onClick={handleCallPatient}
                            className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded-lg shadow"
                        >
                            Firmar Nota
                        </button>
                     )}
                </div>
            </div>
        </div>
    );
};

const PatientQueueWidget: React.FC = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchAppointments = useCallback(async () => {
        try {
            const data = await fetchAppointmentsForToday();
            const doctorAppointments = data
                .filter(apt => apt.doctor.id === user?.id && !['completed', 'cancelled', 'no_show'].includes(apt.status))
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            setAppointments(doctorAppointments);
        } catch (err) {
            console.error("Failed to fetch doctor's appointments", err);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);
    
    useEffect(() => {
        fetchAppointments();
        const timerInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        const dataRefreshInterval = setInterval(fetchAppointments, 30000);
        return () => {
            clearInterval(timerInterval);
            clearInterval(dataRefreshInterval);
        };
    }, [fetchAppointments]);

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center py-8"><Spinner /></div>;
        if (appointments.length === 0) return <p className="text-gray-500 text-center py-8">No tiene más pacientes agendados para hoy.</p>;

        return (
            <div className="space-y-4">
                {appointments.map(apt => (
                    <PatientQueueCard key={apt.id} appointment={apt} currentTime={currentTime} />
                ))}
            </div>
        );
    };

    return (
        <Card title="Cola de Pacientes del Día">
            {renderContent()}
        </Card>
    );
};

export default PatientQueueWidget;
