import React, { useState } from 'react';
import Modal from '../../common/Modal';
import { type LabOrder } from '../../../types';

interface LabOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddLabOrder: (labOrder: LabOrder) => void;
}

const LabOrderModal: React.FC<LabOrderModalProps> = ({ isOpen, onClose, onAddLabOrder }) => {
    const [testName, setTestName] = useState('');
    const [details, setDetails] = useState('');
    const [error, setError] = useState('');
    
    // Mock suggestions
    const commonTests = ["Hemograma Completo", "Perfil Lipídico", "Glucosa en Ayunas", "Creatinina", "Examen General de Orina"];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!testName) {
            setError('Por favor ingrese el nombre del estudio.');
            return;
        }
        
        onAddLabOrder({
            id: `lab-${Date.now()}`,
            testName,
            details,
        });
        
        // Reset form
        setTestName('');
        setDetails('');
    };
    
    const handleSelectCommonTest = (test: string) => {
        setTestName(test);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Añadir Orden de Laboratorio">
            <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Estudios comunes:</p>
                <div className="flex flex-wrap gap-2">
                    {commonTests.map(test => (
                        <button 
                            key={test} 
                            onClick={() => handleSelectCommonTest(test)}
                            className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold py-1 px-2 rounded"
                        >
                            {test}
                        </button>
                    ))}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="testName" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Estudio</label>
                    <input 
                        type="text" 
                        id="testName" 
                        value={testName} 
                        onChange={e => setTestName(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: TSH (Hormona estimulante de la tiroides)"
                    />
                </div>
                 <div>
                    <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">Detalles o Indicaciones (Opcional)</label>
                    <textarea
                        id="details" 
                        value={details} 
                        onChange={e => setDetails(e.target.value)} 
                        className="w-full p-2 border rounded-md"
                        rows={3}
                        placeholder="Ej: En ayunas, suspender medicación X 24h antes"
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

export default LabOrderModal;
