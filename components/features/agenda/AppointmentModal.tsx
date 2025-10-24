import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { createAppointment } from '../../../api/appointments';
import { searchPatients, createQuickPatient } from '../../../api/patients';
import { getDoctors } from '../../../api/users';
import { getAppointmentTypes } from '../../../api/appointmentTypes';
import { useDebounce } from '../../../hooks/useDebounce';
import { type Patient, type User, type AppointmentType, QuickPatientInput } from '../../../types';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppointmentCreated: () => void;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ isOpen, onClose, onAppointmentCreated }) => {
  // Patient state
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(patientSearchQuery, 300);
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Quick patient create state
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [quickPatientData, setQuickPatientData] = useState<QuickPatientInput>({ firstName: '', lastName: '', phone: '' });

  // Appointment details state
  const [doctors, setDoctors] = useState<User[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointmentTime, setAppointmentTime] = useState('');
  const [notes, setNotes] = useState('');

  // General modal state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data for dropdowns
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const [doctorsData, typesData] = await Promise.all([
            getDoctors(),
            getAppointmentTypes()
          ]);
          setDoctors(doctorsData);
          setAppointmentTypes(typesData);
          if (doctorsData.length > 0) setSelectedDoctorId(doctorsData[0].id);
          if (typesData.length > 0) setSelectedTypeId(typesData[0].id);
        } catch (err) {
          setError('Failed to load necessary data.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  // Handle patient search
  useEffect(() => {
    if (debouncedSearchQuery) {
      setIsSearching(true);
      searchPatients(debouncedSearchQuery)
        .then(results => {
          setSearchResults(results);
        })
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery]);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearchQuery('');
    setSearchResults([]);
  };
  
  const handleQuickPatientCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPatientData.firstName || !quickPatientData.lastName) return;
    setIsSubmitting(true);
    try {
        const newPatient = await createQuickPatient(quickPatientData);
        handleSelectPatient(newPatient);
        setIsCreatingPatient(false);
        setQuickPatientData({ firstName: '', lastName: '', phone: '' });
    } catch (err) {
        setError('Failed to create new patient.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const resetState = useCallback(() => {
      setSelectedPatient(null);
      setPatientSearchQuery('');
      setSearchResults([]);
      setIsCreatingPatient(false);
      setQuickPatientData({ firstName: '', lastName: '', phone: '' });
      setAppointmentDate(new Date().toISOString().split('T')[0]);
      setAppointmentTime('');
      setNotes('');
      setError(null);
      setIsSubmitting(false);
      // Don't reset doctors and types as they are static-ish
  }, []);

  const handleClose = () => {
      resetState();
      onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPatient || !selectedDoctorId || !selectedTypeId || !appointmentDate || !appointmentTime) {
      setError('Please fill all required fields.');
      return;
    }
    
    setIsSubmitting(true);

    const doctor = doctors.find(d => d.id === selectedDoctorId);
    const type = appointmentTypes.find(t => t.id === selectedTypeId);

    if (!doctor || !type) {
        setError('Invalid doctor or appointment type selected.');
        setIsSubmitting(false);
        return;
    }

    const startTime = new Date(`${appointmentDate}T${appointmentTime}`).toISOString();
    
    try {
        await createAppointment({
            patient: selectedPatient,
            doctor,
            type,
            startTime,
            notes,
        });
        onAppointmentCreated();
        resetState();
    } catch (err) {
        setError('Failed to create appointment.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleStartQuickCreate = () => {
    const query = patientSearchQuery.trim();
    if (query) {
      const parts = query.split(/\s+/);
      const firstName = parts.shift() || ''; // Take the first word
      const lastName = parts.join(' ');     // Join the rest
      setQuickPatientData({ firstName, lastName, phone: '' });
    }
    setIsCreatingPatient(true);
  };
  
  const renderPatientSelector = () => {
      if (selectedPatient) {
          return (
              <div className="p-3 bg-green-100 border border-green-300 rounded-md">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-900">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <button onClick={() => setSelectedPatient(null)} className="text-sm text-red-600 hover:text-red-800 font-semibold">Cambiar</button>
                  </div>
                  {/* Mock Alert per spec */}
                  {selectedPatient.id === 'patient-2' && (
                      <div className="mt-2 text-sm font-semibold text-red-800 bg-red-100 border-l-4 border-red-500 p-2 rounded-md">
                          ¡Alerta! Paciente tiene un saldo pendiente de Bs. 100.00
                      </div>
                  )}
              </div>
          )
      }
      
      if (isCreatingPatient) {
          return (
              <form onSubmit={handleQuickPatientCreate} className="space-y-2 p-3 bg-gray-50 border rounded-md">
                   <h4 className="font-semibold text-gray-700">Nuevo Paciente Rápido</h4>
                   <input
                        type="text"
                        placeholder="Nombres"
                        value={quickPatientData.firstName}
                        onChange={(e) => setQuickPatientData(p => ({ ...p, firstName: e.target.value }))}
                        className="w-full p-2 border rounded-md" required
                    />
                    <input
                        type="text"
                        placeholder="Apellidos"
                        value={quickPatientData.lastName}
                        onChange={(e) => setQuickPatientData(p => ({ ...p, lastName: e.target.value }))}
                        className="w-full p-2 border rounded-md" required
                    />
                     <input
                        type="text"
                        placeholder="Teléfono"
                        value={quickPatientData.phone}
                        onChange={(e) => setQuickPatientData(p => ({ ...p, phone: e.target.value }))}
                        className="w-full p-2 border rounded-md"
                    />
                    <div className="flex space-x-2">
                        <button type="submit" disabled={isSubmitting} className="bg-teal-500 text-white px-3 py-1 rounded-md text-sm disabled:bg-gray-400">
                            {isSubmitting ? 'Creando...' : 'Crear y Seleccionar'}
                        </button>
                        <button type="button" onClick={() => setIsCreatingPatient(false)} className="bg-gray-200 px-3 py-1 rounded-md text-sm">Cancelar</button>
                    </div>
              </form>
          )
      }

      return (
          <div className="relative">
                <input
                    type="text"
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    placeholder="Buscar paciente por nombre, ID o teléfono..."
                    className="w-full p-2 border rounded-md"
                />
                {isSearching && <div className="p-2 text-gray-500">Buscando...</div>}
                {searchResults.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                        {searchResults.map(p => (
                            <li key={p.id} onClick={() => handleSelectPatient(p)} className="p-2 hover:bg-gray-100 cursor-pointer text-gray-900">
                                {p.firstName} {p.lastName} <span className="text-sm text-gray-500">({p.idNumber || p.contactInfo.phone})</span>
                            </li>
                        ))}
                    </ul>
                )}
                 {debouncedSearchQuery && !isSearching && searchResults.length === 0 && (
                     <div className="p-4 text-center border-t">
                         <p className="text-gray-600 mb-2">No se encontró al paciente.</p>
                         <button onClick={handleStartQuickCreate} className="text-teal-600 hover:underline">
                             + Crear nuevo paciente
                         </button>
                     </div>
                 )}
            </div>
      )
  };

  const renderForm = () => {
      if (isLoading) {
          return <div className="flex justify-center items-center h-48"><Spinner /></div>
      }
      return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
              {renderPatientSelector()}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
                    <select id="doctor" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)} className="w-full p-2 border rounded-md">
                        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cita</label>
                    <select id="type" value={selectedTypeId} onChange={e => setSelectedTypeId(e.target.value)} className="w-full p-2 border rounded-md">
                        {appointmentTypes.map(t => <option key={t.id} value={t.id}>{t.name} ({t.durationMinutes} min)</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
                <div className="flex items-center space-x-2">
                    <input type="date" id="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} className="p-2 border rounded-md w-full" />
                    <input type="time" id="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} className="p-2 border rounded-md w-full" />
                    <button 
                        type="button" 
                        onClick={() => setAppointmentTime('15:30')}
                        title="Encontrar Siguiente Disponible"
                        className="p-2 bg-slate-200 hover:bg-slate-300 rounded-md transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3l2 1" /></svg>
                    </button>
                </div>
            </div>

            <div>
                 <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                 <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-2 border rounded-md"></textarea>
            </div>

            <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-teal-500 focus:ring-teal-400" defaultChecked />
                    <span className="text-sm text-gray-700">Enviar confirmación por WhatsApp/Email</span>
                </label>
            </div>
            
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                <button type="button" onClick={handleClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                    Cancelar
                </button>
                <button type="submit" disabled={isSubmitting || !selectedPatient} className="bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 disabled:bg-gray-400">
                    {isSubmitting ? 'Agendando...' : 'Agendar Cita'}
                </button>
            </div>
          </form>
      )
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nueva Cita Médica">
      {renderForm()}
    </Modal>
  );
};

export default AppointmentModal;