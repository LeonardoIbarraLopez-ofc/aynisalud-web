import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import UpcomingAppointmentWidget from './widgets/UpcomingAppointmentWidget';
import PatientHealthSummaryWidget from './widgets/PatientHealthSummaryWidget';
import QuickLinksWidget from './widgets/QuickLinksWidget';
import PatientInvoicesWidget from '../patient/PatientInvoicesWidget';
import { Spinner } from '../../common/Spinner';
import { getPatientPortalOverview } from '../../../api/patientPortal';
import { type PatientPortalOverview } from '../../../types';

const PatientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [overview, setOverview] = useState<PatientPortalOverview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadOverview = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getPatientPortalOverview();
            setOverview(data);
            setError(null);
        } catch (err) {
            console.error('[PatientDashboard] unable to load overview', err);
            setError('No se pudo cargar la información de su portal. Intente nuevamente.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    const patientName = useMemo(() => {
        if (overview?.patient) {
            return `${overview.patient.firstName} ${overview.patient.lastName}`.trim();
        }
        return user?.name ?? 'Paciente';
    }, [overview, user]);

    const handleScheduleClick = () => {
        navigate('/mis-citas');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Bienvenido a su Portal, {patientName}</h1>
                <p className="text-gray-600">Revise sus próximas citas, estado de pagos y resumen de salud desde un mismo lugar.</p>
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>

            {isLoading && !overview ? (
                <div className="flex justify-center items-center py-12">
                    <Spinner />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2 space-y-6">
                        <UpcomingAppointmentWidget
                            appointments={overview?.upcomingAppointments ?? []}
                            isLoading={isLoading}
                            error={error}
                            onScheduleClick={handleScheduleClick}
                        />
                        {/* Espacio reservado para mensajes, recordatorios o actividades futuras */}
                    </div>

                    <div className="space-y-6">
                        {overview && <PatientHealthSummaryWidget patient={overview.patient} />}
                        <PatientInvoicesWidget
                            pendingInvoices={overview?.pendingInvoices ?? []}
                            recentInvoices={overview?.recentInvoices ?? []}
                            isLoading={isLoading}
                        />
                        <QuickLinksWidget />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboard;
