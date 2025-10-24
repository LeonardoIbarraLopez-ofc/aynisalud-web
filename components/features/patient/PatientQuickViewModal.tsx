import React from 'react';
import Modal from '../../common/Modal';
import { type Patient } from '../../../types';

interface PatientQuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

const InfoRow: React.FC<{ label: string; value: string | undefined | null }> = ({ label, value }) => (
  <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || 'N/A'}</dd>
  </div>
);

const PatientQuickViewModal: React.FC<PatientQuickViewModalProps> = ({ isOpen, onClose, patient }) => {
  if (!patient) return null;
  
  // Mock data for alerts as per spec
  const hasPendingBalance = patient.id === 'patient-1' || patient.id === 'patient-2';
  const nextAppointmentInfo = patient.id === 'patient-1' ? 'Mañana, 09:00 AM con Dr. Mendoza' : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ficha Rápida del Paciente" size="md">
      <div>
        <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">{patient.firstName} {patient.lastName}</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Información administrativa y alertas.</p>
        </div>

        {/* Alerts Section */}
        <div className="px-4 pb-2 space-y-2">
            {hasPendingBalance && (
                 <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3" role="alert">
                    <p className="font-bold">Saldo Pendiente: Bs. 100.00</p>
                </div>
            )}
             {nextAppointmentInfo && (
                 <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-800 p-3" role="alert">
                    <p><span className="font-bold">Próxima Cita:</span> {nextAppointmentInfo}</p>
                </div>
            )}
        </div>


        <div className="border-t border-gray-200">
            <dl className="px-4">
                <InfoRow label="Fecha de Nacimiento" value={patient.dob} />
                <InfoRow label="Género" value={patient.gender} />
                <InfoRow label="Nro. Documento" value={patient.idNumber} />
                <InfoRow label="Teléfono" value={patient.contactInfo.phone} />
                <InfoRow label="Email" value={patient.contactInfo.email} />
            </dl>
        </div>
         {patient.insuranceInfo.length > 0 && (
             <div className="border-t border-gray-200 mt-4">
                <div className="px-4 py-3 sm:px-6">
                    <h4 className="text-md leading-6 font-medium text-gray-900">Seguro Médico</h4>
                </div>
                <dl className="px-4">
                    {patient.insuranceInfo.map((insurance, index) => (
                        <React.Fragment key={index}>
                            <InfoRow label="Proveedor" value={insurance.providerName} />
                            <InfoRow label="Póliza Nro." value={insurance.policyNumber} />
                        </React.Fragment>
                    ))}
                </dl>
             </div>
         )}
      </div>
    </Modal>
  );
};

export default PatientQuickViewModal;