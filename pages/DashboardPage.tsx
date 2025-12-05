import React from 'react';
import ReceptionistDashboard from '../components/features/dashboard/ReceptionistDashboard';
import DoctorDashboard from '../components/features/dashboard/DoctorDashboard';
import PatientDashboard from '../components/features/dashboard/PatientDashboard';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from '../components/common/Spinner';
import AdminDashboard from '../components/features/dashboard/AdminDashboard';

const DashboardPage: React.FC = () => {
    const { user } = useAuth();
    
    if (!user) {
        return (
             <div className="flex items-center justify-center h-screen">
                <Spinner />
            </div>
        )
    }

    switch (user.role) {
        case 'receptionist':
            return <ReceptionistDashboard />;
        case 'doctor':
        case 'specialist':
            return <DoctorDashboard />;
        case 'admin':
            return <AdminDashboard />;
        case 'patient':
            return <PatientDashboard />;
        default:
             return (
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                    <p>Welcome, {user.name}. Your dashboard is under construction.</p>
                </div>
            );
    }
};

export default DashboardPage;
