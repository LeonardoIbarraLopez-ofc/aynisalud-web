import React, { useEffect, useState } from 'react';
import Modal from '../../common/Modal';
import { type LabResult } from '../../../types';

interface LabResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddLabResult: (labResult: LabResult) => void;
}

const LabResultModal: React.FC<LabResultModalProps> = ({ isOpen, onClose, onAddLabResult }) => {
    const [form, setForm] = useState({
        testName: '',
        resultValue: '',
        unit: '',
        referenceRange: '',
        interpretation: '',
        notes: '',
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setForm({
                testName: '',
                resultValue: '',
                unit: '',
                referenceRange: '',
                interpretation: '',
                notes: '',
            });
            setError('');
        }
    }, [isOpen]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setError('');

        if (!form.testName) {
            setError('El nombre del examen es obligatorio.');
            return;
        }

        onAddLabResult({
            id: `lab-result-${Date.now()}`,
            testName: form.testName,
            resultValue: form.resultValue || undefined,
            unit: form.unit || undefined,
            referenceRange: form.referenceRange || undefined,
            interpretation: form.interpretation || undefined,
            notes: form.notes || undefined,
        });

        setForm({
            testName: '',
            resultValue: '',
            unit: '',
            referenceRange: '',
            interpretation: '',
            notes: '',
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Agregar resultado de laboratorio">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="testName">Nombre del examen</label>
                    <input
                        id="testName"
                        name="testName"
                        value={form.testName}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: Hemoglobina"
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="resultValue">Resultado</label>
                        <input
                            id="resultValue"
                            name="resultValue"
                            value={form.resultValue}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md"
                            placeholder="Ej: 13.5"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unit">Unidad</label>
                        <input
                            id="unit"
                            name="unit"
                            value={form.unit}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md"
                            placeholder="Ej: g/dL"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="referenceRange">Rango de referencia</label>
                    <input
                        id="referenceRange"
                        name="referenceRange"
                        value={form.referenceRange}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: 12 - 16"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="interpretation">Interpretación</label>
                    <textarea
                        id="interpretation"
                        name="interpretation"
                        value={form.interpretation}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        rows={2}
                        placeholder="Ej: Dentro de parámetros normales"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">Notas adicionales</label>
                    <textarea
                        id="notes"
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        rows={2}
                        placeholder="Comentarios relevantes del médico"
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                        Agregar resultado
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LabResultModal;
