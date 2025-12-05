import React, { useState } from 'react';
import { type Appointment, type Patient, type Prescription, type LabOrder } from '../../../types';
import { updateAppointmentStatus } from '../../../api/appointments';
import { createConsultationNote } from '../../../api/ehr';
import PrescriptionModal from './PrescriptionModal';
import LabOrderModal from './LabOrderModal';

interface ClinicalNoteEditorProps {
    appointment: Appointment;
    patient: Patient;
    onFinalize: () => void;
    onEventCreated?: (eventId: string) => Promise<void> | void;
}

const ClinicalNoteEditor: React.FC<ClinicalNoteEditorProps> = ({ appointment, patient, onFinalize, onEventCreated }) => {
    const [isNoteStarted, setIsNoteStarted] = useState(appointment.status === 'in_progress');
    const [note, setNote] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    });
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [labOrders, setLabOrders] = useState<LabOrder[]>([]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
    const [isLabOrderModalOpen, setIsLabOrderModalOpen] = useState(false);

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNote(prev => ({ ...prev, [name]: value }));
    };

    const handleAddPrescription = (newPrescription: Prescription) => {
        setPrescriptions(prev => [...prev, newPrescription]);
        setIsPrescriptionModalOpen(false);
    };

    const handleAddLabOrder = (newLabOrder: LabOrder) => {
        setLabOrders(prev => [...prev, newLabOrder]);
        setIsLabOrderModalOpen(false);
    }
    
    const handleStartConsultation = async () => {
        try {
            setIsStarting(true);
            await updateAppointmentStatus(appointment.id, 'in_progress');
            setIsNoteStarted(true);
        } catch (error) {
            console.error('No se pudo iniciar la consulta', error);
            alert('No se pudo iniciar la consulta. Intenta nuevamente.');
        } finally {
            setIsStarting(false);
        }
    };

    const handleFinalize = async () => {
        const pin = prompt("Para firmar la nota, por favor ingrese su PIN de 4 dígitos.");
        if (pin === "1234") { // Mock PIN check
            setIsSubmitting(true);
            try {
                const summaryPieces = [note.assessment, note.plan].filter(Boolean);
                const summary = summaryPieces.length > 0 ? summaryPieces.join(' • ') : 'Consulta clínica finalizada';

                const response = await createConsultationNote({
                    patientId: patient.id,
                    appointmentId: appointment.id,
                    status: 'final',
                    title: `${appointment.type.name} - ${patient.firstName} ${patient.lastName}`.trim(),
                    summary,
                    soapNote: {
                        subjective: note.subjective,
                        objective: note.objective,
                        assessment: note.assessment,
                        plan: note.plan,
                    },
                    prescriptions: prescriptions.length > 0 ? prescriptions : undefined,
                    labOrders: labOrders.length > 0 ? labOrders : undefined,
                    tags: ['consulta'],
                    performedAt: new Date().toISOString(),
                });

                await updateAppointmentStatus(appointment.id, 'attended_pending_payment');
                alert("Consulta finalizada y nota firmada. Notificando a recepción para el check-out.");
                if (onEventCreated) {
                    await onEventCreated(response.eventId);
                }
                onFinalize();
            } catch (error) {
                alert("Error al finalizar la consulta.");
                console.error(error);
            } finally {
                setIsSubmitting(false);
            }
        } else if (pin) {
            alert("PIN incorrecto.");
        }
    };
    
    if (!isNoteStarted) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                 <h3 className="text-xl font-bold text-gray-800 mb-2">Consulta para {patient.firstName} {patient.lastName}</h3>
                 <p className="text-gray-600 mb-4">Motivo: {appointment.notes || appointment.type.name}</p>
                          <button 
                          onClick={handleStartConsultation}
                          disabled={isStarting}
                          className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:hover:scale-100"
                      >
                          {isStarting ? 'Iniciando...' : '+ Iniciar Nota de Consulta'}
                      </button>
            </div>
        )
    }

    return (
        <div className="p-4 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-800">Nota de Consulta</h3>
                <div className="p-1 bg-slate-100 rounded-lg flex space-x-1">
                    <button className="px-3 py-1 text-sm font-semibold text-white bg-slate-700 rounded-md shadow">Seguimiento Hipertensión</button>
                    <button className="px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-300 rounded-md">General</button>
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto space-y-4 pr-2 min-h-0">
                {/* SOAP sections */}
                <div>
                    <label className="font-semibold text-gray-700">Subjetivo</label>
                    <textarea name="subjective" value={note.subjective} onChange={handleNoteChange} rows={4} className="w-full p-2 mt-1 border rounded-md" placeholder="El paciente refiere..." />
                </div>
                <div>
                    <label className="font-semibold text-gray-700">Objetivo</label>
                    <textarea name="objective" value={note.objective} onChange={handleNoteChange} rows={4} className="w-full p-2 mt-1 border rounded-md" placeholder="Al examen físico..." />
                </div>
                <div>
                    <label className="font-semibold text-gray-700">Análisis y Diagnóstico</label>
                    <textarea name="assessment" value={note.assessment} onChange={handleNoteChange} rows={4} className="w-full p-2 mt-1 border rounded-md" placeholder="Impresión diagnóstica, CIE-10..." />
                </div>

                {/* Plan section */}
                <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Plan de Acción</h4>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                        {/* Prescriptions */}
                        <div>
                            <div className="flex justify-between items-center">
                                <h5 className="font-semibold text-gray-600">Recetas</h5>
                                <button onClick={() => setIsPrescriptionModalOpen(true)} className="text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold py-1 px-2 rounded">+ Añadir</button>
                            </div>
                            <ul className="mt-2 text-sm list-disc list-inside">
                                {prescriptions.map((p, i) => <li key={i}>{p.medicationName} {p.dosage} - {p.frequency}</li>)}
                            </ul>
                        </div>
                        {/* Lab Orders */}
                         <div>
                            <div className="flex justify-between items-center">
                                <h5 className="font-semibold text-gray-600">Órdenes de Laboratorio</h5>
                                <button onClick={() => setIsLabOrderModalOpen(true)} className="text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold py-1 px-2 rounded">+ Añadir</button>
                            </div>
                             <ul className="mt-2 text-sm list-disc list-inside">
                                {labOrders.map((l, i) => <li key={i}>{l.testName}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>

                 <div>
                    <label className="font-semibold text-gray-700">Indicaciones Adicionales</label>
                    <textarea name="plan" value={note.plan} onChange={handleNoteChange} rows={3} className="w-full p-2 mt-1 border rounded-md" placeholder="Próxima cita, recomendaciones..." />
                </div>
            </div>

            <div className="pt-4 mt-2 border-t flex-shrink-0">
                <button 
                    onClick={handleFinalize}
                    disabled={isSubmitting}
                    className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:bg-gray-400"
                >
                    {isSubmitting ? 'Firmando...' : 'Firmar y Finalizar Consulta'}
                </button>
            </div>

            {isPrescriptionModalOpen && (
                <PrescriptionModal 
                    isOpen={isPrescriptionModalOpen}
                    onClose={() => setIsPrescriptionModalOpen(false)}
                    onAddPrescription={handleAddPrescription}
                    patient={patient}
                />
            )}
            {isLabOrderModalOpen && (
                 <LabOrderModal 
                    isOpen={isLabOrderModalOpen}
                    onClose={() => setIsLabOrderModalOpen(false)}
                    onAddLabOrder={handleAddLabOrder}
                />
            )}
        </div>
    );
};

export default ClinicalNoteEditor;
