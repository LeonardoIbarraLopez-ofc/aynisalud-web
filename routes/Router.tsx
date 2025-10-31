import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import AgendaPage from '../pages/AgendaPage';
import AppLayout from '../layouts/AppLayout';
import ConsultationPage from '../pages/ConsultationPage';
import PatientAppointmentsPage from '../pages/PatientAppointmentsPage';
const PatientMedicalHistoryPage = React.lazy(() => import('../pages/PatientMedicalHistoryPage'));
const AdminUsersPage = React.lazy(() => import('../pages/AdminUsersPage'));

const AdminOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    if (!user || (user as any).role !== 'admin') {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
};

const ProtectedRoute: React.FC = () => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return (
        <AppLayout>
            <Outlet />
        </AppLayout>
    );
};

const AppRouter: React.FC = () => {
    const { isAuthenticated } = useAuth();
    return (
        <HashRouter>
            <Routes>
                <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<DashboardPage />} />
                    {/* Clinic Staff Routes */}
                    <Route path="/agenda" element={<AgendaPage />} />
                    <Route path="/consulta/:appointmentId" element={<ConsultationPage />} />

                    {/* Patient Portal Routes */}
                    <Route path="/mis-citas" element={<PatientAppointmentsPage />} />
                    <Route path="/facturacion" element={<div className="p-4">Página de Facturación (en construcción)</div>} />
                    <Route path="/historial" element={<React.Suspense fallback={<div className="p-4">Cargando...</div>}><PatientMedicalHistoryPage /></React.Suspense>} />

                    {/* Admin Routes */}
                    <Route path="/admin/usuarios" element={<AdminOnly><React.Suspense fallback={<div className="p-4">Cargando...</div>}><AdminUsersPage /></React.Suspense></AdminOnly>} />
                </Route>
                 <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </HashRouter>
    );
};

export default AppRouter;
