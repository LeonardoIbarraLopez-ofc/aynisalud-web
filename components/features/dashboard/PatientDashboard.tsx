import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import UpcomingAppointmentWidget from './widgets/UpcomingAppointmentWidget';
import PatientHealthSummaryWidget from './widgets/PatientHealthSummaryWidget';
import QuickLinksWidget from './widgets/QuickLinksWidget';
import { mockPatients } from '../../../api/mockData';

const PatientDashboard: React.FC = () => {
    const { user } = useAuth();

    // In a real app, this patient data would come from an API call based on the logged-in user.
    // Here, we find the matching patient profile from mock data.
    const patientProfile = mockPatients.find(p => p.contactInfo.email === user?.email);

    if (!patientProfile) {
        return <div className="text-red-500">Could not find a patient profile for the logged-in user.</div>
    }
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Bienvenido a su Portal, {user?.name}</h1>
                <p className="text-gray-600">Aquí puede gestionar sus citas y ver su información de salud.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <UpcomingAppointmentWidget patientId={patientProfile.id} />
                    {/* Future widgets like a message inbox or recent activity could go here */}
                </div>

                <div className="space-y-6">
                    <PatientHealthSummaryWidget patient={patientProfile} />
                    <QuickLinksWidget />
                </div>
            </div>
        </div>
    );
};

export default PatientDashboard;
