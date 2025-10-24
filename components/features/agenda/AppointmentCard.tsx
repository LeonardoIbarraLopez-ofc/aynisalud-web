import React, { useState, useEffect } from 'react';
import { type Appointment } from '../../../types';
import PatientQuickViewModal from '../patient/PatientQuickViewModal';

interface AppointmentCardProps {
  appointment: Appointment;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
  onStartCheckout: (appointment: Appointment) => void;
  currentTime: Date;
}

const statusStyles: { [key in Appointment['status']]: { bg: string, text: string, border: string, label: string } } = {
    pending_confirmation: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400', label: 'Pendiente' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400', label: 'Confirmada' },
    checked_in: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400', label: 'En Sala de Espera' },
    in_progress: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-400', label: 'En Consulta' },
    attended_pending_payment: { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-400', label: 'Pendiente de Pago' },
    completed: { bg: 'bg-slate-200', text: 'text-slate-600', border: 'border-slate-400', label: 'Completado' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-400', label: 'Cancelada' },
    no_show: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-400', label: 'No se presentó' }
};

const HoverActions: React.FC<{ appointment: Appointment, onUpdateStatus: (id: string, status: Appointment['status']) => void, onStartCheckout: (appointment: Appointment) => void, onOpenQuickView: () => void }> = ({ appointment, onUpdateStatus, onStartCheckout, onOpenQuickView }) => {
    const { id, status } = appointment;
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isMoreMenuOpen && !(event.target as HTMLElement).closest('.more-menu-container')) {
                setIsMoreMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMoreMenuOpen]);

    const handleCheckIn = () => {
        // Simulate checking for pending balance as per spec
        if (appointment.patient.id === 'patient-2') { // Mock alert for a specific patient
            if(window.confirm(`¡Alerta! Paciente ${appointment.patient.firstName} ${appointment.patient.lastName} tiene un saldo pendiente de Bs. 100.00. ¿Desea continuar con el check-in?`)) {
                onUpdateStatus(id, 'checked_in');
            }
        } else {
            onUpdateStatus(id, 'checked_in');
        }
    }

    const handleCancel = () => {
        if(window.confirm('¿Está seguro que desea cancelar esta cita?')) {
            onUpdateStatus(id, 'cancelled');
        }
        setIsMoreMenuOpen(false);
    }
    
    const handleNoShow = () => {
        if(window.confirm('¿Está seguro que desea marcar esta cita como "No se presentó"?')) {
            onUpdateStatus(id, 'no_show');
        }
        setIsMoreMenuOpen(false);
    }
    
    const handleOpenQuickView = () => {
        onOpenQuickView();
        setIsMoreMenuOpen(false);
    }

    const actionButtons: React.ReactNode[] = [];
    const canBeModified = ['pending_confirmation', 'confirmed'].includes(status);

    if (canBeModified) {
        actionButtons.push(
             <button
                key="checkin"
                onClick={handleCheckIn}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-3 rounded-md text-sm whitespace-nowrap"
            >
                Registrar Llegada
            </button>
        );
    }
    
    if (status === 'checked_in') {
        actionButtons.push(
            <button
                key="start"
                onClick={() => onUpdateStatus(id, 'in_progress')}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-1 px-3 rounded-md text-sm whitespace-nowrap"
            >
                Iniciar Cita
            </button>
        );
    }
    
    if (status === 'in_progress') {
         actionButtons.push(
             <button
                key="finish"
                onClick={() => onUpdateStatus(id, 'attended_pending_payment')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1 px-3 rounded-md text-sm whitespace-nowrap"
            >
                Terminar Consulta
            </button>
        );
    }

    if (status === 'attended_pending_payment') {
        actionButtons.push(
            <button
                key="checkout"
                onClick={() => onStartCheckout(appointment)}
                className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-1 px-3 rounded-md text-sm"
            >
                Check-out
            </button>
        );
    }

    if (!['completed', 'cancelled', 'no_show'].includes(status)) {
         actionButtons.push(
            <div key="more" className="relative more-menu-container">
                <button 
                    onClick={() => setIsMoreMenuOpen(prev => !prev)} 
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-1 px-3 rounded-md text-sm"
                >
                    Más
                </button>
                {isMoreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border">
                        <ul className="py-1">
                            <li><button onClick={handleOpenQuickView} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Ver Ficha Rápida</button></li>
                            { canBeModified &&
                                <>
                                    <li><button onClick={() => { alert('Función de reprogramar no implementada.'); setIsMoreMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Reprogramar</button></li>
                                    <li><button onClick={handleCancel} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Cancelar Cita</button></li>
                                    <li><button onClick={handleNoShow} className="block w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-gray-100">Registrar Ausencia</button></li>
                                </>
                            }
                        </ul>
                    </div>
                )}
            </div>
         );
    }
    
    if(actionButtons.length === 0) return null;

    return (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {actionButtons}
        </div>
    )
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, onUpdateStatus, onStartCheckout, currentTime }) => {
  const { patient, doctor, startTime, status, type, checkinTime } = appointment;
  const style = statusStyles[status];
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);


  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  
  const getWaitTime = () => {
      if(status !== 'checked_in' || !checkinTime) return null;
      const diffMs = currentTime.getTime() - new Date(checkinTime).getTime();
      const diffMins = Math.round(diffMs / 60000);
      const color = diffMins > 15 ? 'text-red-600' : diffMins > 10 ? 'text-yellow-600' : 'text-green-600';
      return <span className={`font-bold ${color}`}>Esperando {diffMins} min</span>
  }

  return (
    <>
        <div className={`p-4 rounded-lg border-l-4 flex items-center justify-between transition-shadow hover:shadow-lg relative group ${style.bg} ${style.border}`}>
        <div className="flex items-center">
            <div className="text-center w-20 mr-4">
                <p className="text-lg font-bold text-gray-800">{formatTime(startTime)}</p>
                <p className="text-sm text-gray-500">{type.durationMinutes} min</p>
            </div>
            <div>
            <p className="font-bold text-lg text-gray-900">{patient.firstName} {patient.lastName}</p>
            <p className="text-sm text-gray-600">con {doctor.name}</p>
            <p className="text-sm text-gray-600 font-medium">{type.name}</p>
            </div>
        </div>
        <div className="flex items-center space-x-4">
            <div className="text-right">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text}`}>{style.label}</span>
                {status === 'checked_in' && <div className="text-sm mt-1">{getWaitTime()}</div>}
            </div>
            <div className="w-40 text-right">
                <HoverActions 
                    appointment={appointment} 
                    onUpdateStatus={onUpdateStatus}
                    onStartCheckout={onStartCheckout} 
                    onOpenQuickView={() => setIsQuickViewOpen(true)}
                />
            </div>
        </div>
        </div>
        {isQuickViewOpen && (
            <PatientQuickViewModal
                isOpen={isQuickViewOpen}
                onClose={() => setIsQuickViewOpen(false)}
                patient={appointment.patient}
            />
        )}
    </>
  );
};

export default AppointmentCard;