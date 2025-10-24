import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAppointmentsForToday } from '../../../../api/appointments';
import { type Appointment } from '../../../../types';
import { Spinner } from '../../../common/Spinner';
import Card from '../../../common/Card';
import CheckoutModal from '../../billing/CheckoutModal';

const CheckoutWidget: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

    const loadAppointments = useCallback(async () => {
        // Don't set loading on refetch
        try {
            const allAppointments = await fetchAppointmentsForToday();
            setAppointments(allAppointments);
        } catch (error) {
            console.error("Failed to load appointments for checkout", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAppointments();
        const interval = setInterval(loadAppointments, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [loadAppointments]);
    
    const pendingCheckout = useMemo(() => {
        return appointments.filter(a => a.status === 'attended_pending_payment')
            .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
    }, [appointments]);

    const handleCheckoutComplete = () => {
        setSelectedAppointment(null);
        loadAppointments();
    }

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center py-4"><Spinner /></div>;
        if (pendingCheckout.length === 0) {
            return <p className="text-gray-500 text-center py-4">No hay pacientes pendientes de check-out.</p>;
        }
        return (
            <ul className="space-y-3">
                {pendingCheckout.map(apt => (
                    <li key={apt.id} className="flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-gray-800">{apt.patient.firstName} {apt.patient.lastName}</p>
                            <p className="text-sm text-gray-500">{apt.type.name} con {apt.doctor.name}</p>
                        </div>
                        <button 
                            onClick={() => setSelectedAppointment(apt)} 
                            className="text-xs bg-teal-500 text-white hover:bg-teal-600 font-semibold py-1 px-2 rounded whitespace-nowrap"
                        >
                            Procesar Pago
                        </button>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <>
            <Card title="Pendiente de Check-out">
                {renderContent()}
            </Card>
            {selectedAppointment && (
                <CheckoutModal 
                    isOpen={!!selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    appointment={selectedAppointment}
                    onCheckoutComplete={handleCheckoutComplete}
                />
            )}
        </>
    );
};

export default CheckoutWidget;