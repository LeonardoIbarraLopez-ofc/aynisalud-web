import React, { useEffect, useState } from 'react';
import Modal from '../../common/Modal';
import { type ConsultationDocument } from '../../../types';

interface DocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddDocument: (document: ConsultationDocument) => void;
}

const DocumentModal: React.FC<DocumentModalProps> = ({ isOpen, onClose, onAddDocument }) => {
    const [form, setForm] = useState({
        title: '',
        description: '',
        url: '',
        type: '',
    });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setForm({ title: '', description: '', url: '', type: '' });
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

        if (!form.title) {
            setError('El título del documento es obligatorio.');
            return;
        }

        onAddDocument({
            id: `document-${Date.now()}`,
            title: form.title,
            description: form.description || undefined,
            url: form.url || undefined,
            type: form.type || undefined,
        });

        setForm({ title: '', description: '', url: '', type: '' });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adjuntar documento">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">Título</label>
                    <input
                        id="title"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        placeholder="Ej: Informe radiológico"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">Descripción</label>
                    <textarea
                        id="description"
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        rows={3}
                        placeholder="Resumen del documento o hallazgos relevantes"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="url">Enlace al archivo (opcional)</label>
                    <input
                        id="url"
                        name="url"
                        value={form.url}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        placeholder="https://..."
                        type="url"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="type">Tipo de archivo</label>
                    <input
                        id="type"
                        name="type"
                        value={form.type}
                        onChange={handleChange}
                        className="w-full p-2 border rounded-md"
                        placeholder="PDF, Imagen, Informe, etc."
                    />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                        Agregar documento
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default DocumentModal;
