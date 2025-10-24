import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAppointmentsForPatient } from '../../../../api/appointments';
import { type Appointment } from '../../../../types';
import { Spinner } from '../../../common/Spinner';
import Card from '../../../common/Card';

interface UpcomingAppointmentWidgetProps {
    patientId: string;
}

const UpcomingAppointmentWidget: React.FC<UpcomingAppointmentWidgetProps> = ({ patientId }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAppointments = useCallback(async () => {
        try {
            const data = await fetchAppointmentsForPatient(patientId);
            setAppointments(data);
        } catch (err) {
            setError('No se pudieron cargar sus citas.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const upcomingAppointment = useMemo(() => {
        const now = new Date();
        return appointments
            .filter(apt => new Date(apt.startTime) > now && (apt.status === 'confirmed' || apt.status === 'pending_confirmation'))
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    }, [appointments]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center py-8"><Spinner /></div>;
        }
        if (error) {
            return <p className="text-red-500 text-sm text-center py-8">{error}</p>;
        }
        if (!upcomingAppointment) {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No tiene próximas citas programadas.</p>
                    <button className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg">
                        Solicitar una Cita
                    </button>
                </div>
            );
        }
        
        const { doctor, startTime, type, notes, status } = upcomingAppointment;
        const appointmentDate = new Date(startTime);

        return (
            <div className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:space-x-6">
                    <div className="text-center p-4 bg-teal-500 text-white rounded-lg mb-4 md:mb-0">
                        <p className="text-sm uppercase font-bold tracking-wider">{appointmentDate.toLocaleString('es-ES', { month: 'short' })}</p>
                        <p className="text-4xl font-extrabold">{appointmentDate.getDate()}</p>
                        <p className="text-sm">{appointmentDate.getFullYear()}</p>
                    </div>
                    <div className="flex-grow">
                        <h4 className="text-2xl font-bold text-gray-800">{type.name}</h4>
                        <p className="text-gray-600">con <span className="font-semibold">{doctor.name}</span></p>
                        <p className="text-lg font-semibold text-teal-600 mt-1">{appointmentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} ({type.durationMinutes} min)</p>
                        {notes && <p className="text-sm text-gray-500 mt-2">Notas: {notes}</p>}
                    </div>
                </div>
                 <div className="border-t mt-6 pt-4 flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
                    <div className="text-sm text-gray-600">
                       Estado: <span className={`font-semibold ${status === 'confirmed' ? 'text-green-700' : 'text-yellow-700'}`}>{status === 'confirmed' ? 'Confirmada' : 'Pendiente de Confirmación'}</span>
                    </div>
                    <div className="flex space-x-2">
                        {status === 'pending_confirmation' && <button className="bg-green-100 text-green-800 hover:bg-green-200 text-sm font-semibold px-4 py-2 rounded-lg">Confirmar Asistencia</button>}
                        <button className="bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm font-semibold px-4 py-2 rounded-lg">Reprogramar</button>
                        <button className="bg-red-50 text-red-700 hover:bg-red-100 text-sm font-semibold px-4 py-2 rounded-lg">Cancelar Cita</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <Card title="Próxima Cita">
            {renderContent()}
        </Card>
    );
};

export default UpcomingAppointmentWidget;
