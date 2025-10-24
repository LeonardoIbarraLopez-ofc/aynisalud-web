import React, { useState, useEffect, useCallback } from 'react';
import { fetchAppointmentsForToday, updateAppointmentStatus } from '../../../../api/appointments';
import { type Appointment } from '../../../../types';
import { Spinner } from '../../../common/Spinner';
import Card from '../../../common/Card';

const TasksWidget: React.FC = () => {
    const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadPendingAppointments = useCallback(async () => {
        setIsLoading(true);
        try {
            const allAppointments = await fetchAppointmentsForToday();
            const pending = allAppointments.filter(a => a.status === 'pending_confirmation');
            setPendingAppointments(pending);
        } catch (error) {
            console.error("Failed to load pending appointments", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPendingAppointments();
    }, [loadPendingAppointments]);

    const handleConfirm = async (id: string) => {
        // Optimistic update
        setPendingAppointments(prev => prev.filter(a => a.id !== id));
        try {
            await updateAppointmentStatus(id, 'confirmed');
            // Optionally, refresh data from source
            // loadPendingAppointments(); 
        } catch (error) {
            alert('Failed to confirm appointment');
            loadPendingAppointments(); // Revert on failure
        }
    }

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center py-4"><Spinner /></div>;
        if (pendingAppointments.length === 0) {
            return <p className="text-gray-500 text-center py-4">No hay confirmaciones pendientes.</p>;
        }
        return (
            <ul className="space-y-3">
                {pendingAppointments.map(apt => (
                    <li key={apt.id} className="flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-gray-800">{apt.patient.firstName} {apt.patient.lastName}</p>
                            <p className="text-sm text-gray-500">{new Date(apt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} con {apt.doctor.name}</p>
                        </div>
                        <div className="flex space-x-2">
                             <button onClick={() => handleConfirm(apt.id)} className="text-xs bg-teal-100 text-teal-700 hover:bg-teal-200 font-semibold py-1 px-2 rounded">Confirmar</button>
                             <button className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold py-1 px-2 rounded">Llamar</button>
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <Card title="Tareas y Notificaciones">
            {renderContent()}
        </Card>
    );
};

export default TasksWidget;
