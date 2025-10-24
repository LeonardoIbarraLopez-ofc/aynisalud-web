import React from 'react';
import PageHeader from '../components/common/PageHeader';

const PatientAppointmentsPage: React.FC = () => {
  return (
    <div>
      <PageHeader title="Mis Citas Médicas">
        <div className="flex items-center space-x-2">
            <button className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">
                Solicitar Nueva Cita
            </button>
        </div>
      </PageHeader>
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h2 className="text-xl font-semibold text-gray-700">Página en Construcción</h2>
        <p className="text-gray-500 mt-2">Aquí podrá ver el historial de sus citas pasadas y futuras.</p>
      </div>
    </div>
  );
};

export default PatientAppointmentsPage;
