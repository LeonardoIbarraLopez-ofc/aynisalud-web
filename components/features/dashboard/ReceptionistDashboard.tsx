import React, { useState } from 'react';
import AgendaDayView from '../agenda/AgendaDayView';
import WaitingRoomWidget from './widgets/WaitingRoomWidget';
import TasksWidget from './widgets/TasksWidget';
import CashboxWidget from './widgets/CashboxWidget';
import AppointmentModal from '../agenda/AppointmentModal';
import CheckoutWidget from './widgets/CheckoutWidget';

const ReceptionistDashboard: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAppointmentCreated = () => {
    setIsModalOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard de Recepción</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105"
        >
          + Nueva Cita
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <AgendaDayView isWidget={true} refreshTrigger={refreshTrigger} />
        </div>
        <div className="space-y-6">
          <TasksWidget />
          <WaitingRoomWidget />
          <CheckoutWidget />
          <CashboxWidget />
        </div>
      </div>

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

export default ReceptionistDashboard;