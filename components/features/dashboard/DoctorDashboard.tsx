import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import PatientQueueWidget from './widgets/PatientQueueWidget';
import UnifiedInboxWidget from './widgets/UnifiedInboxWidget';
import RemoteMonitoringWidget from './widgets/RemoteMonitoringWidget';

const DoctorDashboard: React.FC = () => {
    const { user } = useAuth();
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Centro de Mando Clínico</h1>
                <p className="text-gray-600">Bienvenido, {user?.name}. Aquí está su resumen para hoy.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                {/* Main Column: Patient Queue */}
                <div className="xl:col-span-2">
                    <PatientQueueWidget />
                </div>

                {/* Right Sidebar: Widgets */}
                <div className="space-y-6">
                    <UnifiedInboxWidget />
                    <RemoteMonitoringWidget />
                </div>
            </div>
        </div>
    );
};

export default DoctorDashboard;
