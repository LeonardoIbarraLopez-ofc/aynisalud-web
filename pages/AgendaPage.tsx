import React, { useState, useEffect } from 'react';
import AgendaDayView from '../components/features/agenda/AgendaDayView';
import PageHeader from '../components/common/PageHeader';
import AppointmentModal from '../components/features/agenda/AppointmentModal';
import { getDoctors } from '../api/users';
import { type User } from '../types';

const statusOptions = [
    { value: 'pending_confirmation', label: 'Pendiente' },
    { value: 'confirmed', label: 'Confirmada' },
    { value: 'checked_in', label: 'En Sala de Espera' },
    { value: 'in_progress', label: 'En Consulta' },
    { value: 'attended_pending_payment', label: 'Pendiente de Pago' },
    { value: 'completed', label: 'Completado' },
    { value: 'cancelled', label: 'Cancelada' },
    { value: 'no_show', label: 'No se presentó' }
];

const AgendaPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [filterDoctorId, setFilterDoctorId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
      getDoctors().then(setDoctors).catch(console.error);
  }, []);

  const handleAppointmentCreated = () => {
      setIsModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div>
      <PageHeader title="Agenda del Día">
        <div className="flex items-center space-x-2">
            <select onChange={(e) => setFilterDoctorId(e.target.value)} value={filterDoctorId} className="p-2 border rounded-md bg-white text-sm shadow-sm">
                <option value="all">Todos los Doctores</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select onChange={(e) => setFilterStatus(e.target.value)} value={filterStatus} className="p-2 border rounded-md bg-white text-sm shadow-sm">
                <option value="all">Todos los Estados</option>
                {statusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <div className="p-1 bg-slate-200 rounded-lg flex space-x-1">
                <button className="px-3 py-1 text-sm font-semibold text-white bg-slate-700 rounded-md shadow">Día</button>
                <button className="px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-300 rounded-md">Semana</button>
                <button className="px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-300 rounded-md">Mes</button>
            </div>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
                + Nueva Cita
            </button>
        </div>
      </PageHeader>

      <AgendaDayView 
        refreshTrigger={refreshTrigger} 
        filters={{ doctorId: filterDoctorId, status: filterStatus }} 
      />
      
      {isModalOpen && (
        <AppointmentModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onAppointmentCreated={handleAppointmentCreated}
        />
      )}
    </div>
  );
};

export default AgendaPage;