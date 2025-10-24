import React, { useState } from 'react';
import Modal from '../../common/Modal';
import { type Prescription, type Patient } from '../../../types';

interface PrescriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddPrescription: (prescription: Prescription) => void;
    patient: Patient;
}

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ isOpen, onClose, onAddPrescription, patient }) => {
    const [medicationName, setMedicationName] = useState('');
    const [dosage, setDosage] = useState('');
    const [frequency, setFrequency] = useState('');
    const [duration, setDuration] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!medicationName || !dosage || !frequency) {
            setError('Por favor complete todos los campos requeridos.');
            return;
        }

        // Mock Clinical Decision Support: Allergy check
        const patientAllergies = patient.allergies.map(a => a.toLowerCase());
        if (patientAllergies.some(allergy => medicationName.toLowerCase().includes(allergy))) {
            if (!window.confirm(`¡ALERTA CRÍTICA! El paciente tiene alergia a "${patient.allergies.join(', ')}". ¿Está seguro que desea continuar con esta prescripción?`)) {
                return;
            }
        }
        
        onAddPrescription({
            id: `pres-${Date.now()}`,
            medicationName,
            dosage,
            frequency,
            duration,
        });
        
        // Reset form
        setMedicationName('');
        setDosage('');
        setFrequency('');
        setDuration('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Añadir Nueva Receta">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="medicationName" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Medicamento</label>
                    <input 
                        type="text" 
                        id="medicationName" 
                        value={medicationName} 
                        onChange={e => setMedicationName(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: Amoxicilina"
                    />
                </div>
                 <div>
                    <label htmlFor="dosage" className="block text-sm font-medium text-gray-700 mb-1">Dosis</label>
                    <input 
                        type="text" 
                        id="dosage" 
                        value={dosage} 
                        onChange={e => setDosage(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: 500mg"
                    />
                </div>
                 <div>
                    <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                    <input 
                        type="text" 
                        id="frequency" 
                        value={frequency} 
                        onChange={e => setFrequency(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: 1 tableta cada 8 horas"
                    />
                </div>
                 <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">Duración (Opcional)</label>
                    <input 
                        type="text" 
                        id="duration" 
                        value={duration} 
                        onChange={e => setDuration(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: por 7 días"
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                        Añadir a la Consulta
                    </button>
                </div>
            </form>
        </Modal>
    )
};

export default PrescriptionModal;
