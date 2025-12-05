import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import UpcomingAppointmentWidget from './widgets/UpcomingAppointmentWidget';
import PatientHealthSummaryWidget from './widgets/PatientHealthSummaryWidget';
import QuickLinksWidget from './widgets/QuickLinksWidget';
import PatientInvoicesWidget from '../patient/PatientInvoicesWidget';
import { Spinner } from '../../common/Spinner';
import { type PatientPortalOverview } from '../../../types';

// Mock data for patient portal overview
const MOCK_PATIENT_OVERVIEW: PatientPortalOverview = {
  patient: {
    id: 'patient-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    dob: '1985-06-15',
    gender: 'male',
    idNumber: '12345678',
    contactInfo: {
      email: 'juan.perez@local.test',
      phone: '+591 71234567',
      address: 'Calle Principal 123, La Paz',
    },
    insuranceInfo: [
      {
        providerName: 'Seguro Nacional',
        policyNumber: 'POL-123456',
        coverageDetails: 'Cobertura completa',
      },
    ],
    allergies: ['Penicilina'],
    chronicConditions: ['Hipertensión'],
    avatarUrl: '',
  },
  upcomingAppointments: [
    {
      id: 'appt-1',
      patient: {
        id: 'patient-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        dob: '1985-06-15',
        gender: 'male',
        idNumber: '12345678',
        contactInfo: {
          email: 'juan.perez@local.test',
          phone: '+591 71234567',
          address: 'Calle Principal 123, La Paz',
        },
        insuranceInfo: [],
        allergies: [],
        chronicConditions: [],
        avatarUrl: '',
      },
      doctor: {
        id: 'doctor-1',
        name: 'Dr. Ejemplo',
        email: 'doctor@local.test',
        role: 'doctor',
        isActive: true,
        clinicId: 'clinic-1',
      },
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      status: 'confirmed',
      type: {
        id: 'consulta-general',
        name: 'Consulta General',
        durationMinutes: 30,
        price: 150,
        description: 'Chequeo de rutina.',
      },
      notes: 'Control de hipertensión',
    },
    {
      id: 'appt-2',
      patient: {
        id: 'patient-1',
        firstName: 'Juan',
        lastName: 'Pérez',
        dob: '1985-06-15',
        gender: 'male',
        idNumber: '12345678',
        contactInfo: {
          email: 'juan.perez@local.test',
          phone: '+591 71234567',
          address: 'Calle Principal 123, La Paz',
        },
        insuranceInfo: [],
        allergies: [],
        chronicConditions: [],
        avatarUrl: '',
      },
      doctor: {
        id: 'specialist-1',
        name: 'Especialista Ejemplo',
        email: 'specialist@local.test',
        role: 'specialist',
        isActive: true,
        clinicId: 'clinic-1',
      },
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
      status: 'confirmed',
      type: {
        id: 'consulta-especialista',
        name: 'Consulta Especialista',
        durationMinutes: 45,
        price: 250,
        description: 'Consulta con especialista.',
      },
      notes: 'Consulta con cardiólogo',
    },
  ],
  pendingInvoices: [
    {
      id: 'inv-1',
      patientId: 'patient-1',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'sent',
      items: [
        {
          description: 'Consulta General',
          quantity: 1,
          unitPrice: 150,
          total: 150,
        },
      ],
      subtotal: 150,
      tax: 0,
      total: 150,
      paymentDetails: [],
      lastPaymentAt: null,
    },
  ],
  recentInvoices: [
    {
      id: 'inv-2',
      patientId: 'patient-1',
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      dueDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'paid',
      items: [
        {
          description: 'Consulta General',
          quantity: 1,
          unitPrice: 150,
          total: 150,
        },
      ],
      subtotal: 150,
      tax: 0,
      total: 150,
      paymentDetails: [
        {
          amount: 150,
          method: 'Efectivo',
          transactionDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      lastPaymentAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

const PatientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [overview, setOverview] = useState<PatientPortalOverview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadOverview = useCallback(async () => {
        setIsLoading(true);
        try {
            // Simulate API delay for realistic loading experience
            await new Promise(resolve => setTimeout(resolve, 500));
            setOverview(MOCK_PATIENT_OVERVIEW);
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
