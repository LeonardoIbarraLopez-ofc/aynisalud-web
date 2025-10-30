import React from 'react';
import PageHeader from '../components/common/PageHeader';
import PatientCalendar from '../components/features/patient/PatientCalendar';

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

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Main calendar view */}
          <PatientCalendar />
        </div>

        <aside className="hidden lg:block">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h4 className="font-semibold text-gray-700">Ayuda rápida</h4>
            <p className="text-sm text-gray-500 mt-2">Aquí verá las próximas citas, opciones para reprogramar y acceso a su historial.</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PatientAppointmentsPage;
