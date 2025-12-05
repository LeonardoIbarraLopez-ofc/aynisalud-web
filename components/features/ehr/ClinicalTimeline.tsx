import React, { useState, useMemo } from 'react';
import { type ClinicalTimelineEvent } from '../../../types';

const EventIcon: React.FC<{ type: ClinicalTimelineEvent['type'] }> = ({ type }) => {
    const icons: Record<ClinicalTimelineEvent['type'], React.ReactNode> = {
    ConsultationNote: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    LabResult: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    Prescription: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V4m0 16v-2M5 12h2a7 7 0 0010 0h2" /></svg>,
    ImageStudy: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Procedure: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Vital: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
    Document: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    };
    return icons[type] || null;
}

const TimelineEventCard: React.FC<{ event: ClinicalTimelineEvent }> = ({ event }) => {
    const metadata = (event.metadata || {}) as Record<string, any>;
    const prescriptions = Array.isArray(metadata.prescriptions) ? metadata.prescriptions : [];
    const labOrders = Array.isArray(metadata.labOrders) ? metadata.labOrders : [];
    const labResults = Array.isArray(metadata.labResults) ? metadata.labResults : [];
    const documents = Array.isArray(metadata.attachments) ? metadata.attachments : [];
    const vitals = Array.isArray(metadata.vitals) ? metadata.vitals : [];
    const soapNote = metadata?.soapNote && typeof metadata.soapNote === 'object' ? metadata.soapNote : null;

    return (
        <div className="relative pl-8">
            <div className="absolute left-0 top-1.5 transform -translate-x-1/2 w-4 h-4 bg-teal-500 rounded-full border-2 border-white"></div>
            <div className="p-3 bg-slate-50 rounded-lg ml-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold text-gray-800">{event.title}</span>
                    <span className="text-xs text-gray-500">{new Date(event.date).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-600">{event.summary}</p>
                {metadata?.status && <p className="text-xs text-gray-500 mt-1">Estado: {metadata.status}</p>}

                {soapNote && (
                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                        <strong>SOAP:</strong>
                        <p><span className="font-semibold">S:</span> {soapNote.subjective || '—'}</p>
                        <p><span className="font-semibold">O:</span> {soapNote.objective || '—'}</p>
                        <p><span className="font-semibold">A:</span> {soapNote.assessment || '—'}</p>
                        <p><span className="font-semibold">P:</span> {soapNote.plan || '—'}</p>
                    </div>
                )}

                {prescriptions.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                        <strong>Recetas:</strong>
                        <ul className="list-disc list-inside">
                            {prescriptions.map((rx: any, index: number) => (
                                <li key={`rx-${index}`}>
                                    <span className="font-semibold">{rx.medicationName}</span>
                                    {rx.dosage && <> • {rx.dosage}</>}
                                    {rx.frequency && <> • {rx.frequency}</>}
                                    {rx.duration && <> • {rx.duration}</>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {labOrders.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                        <strong>Órdenes de laboratorio:</strong>
                        <ul className="list-disc list-inside">
                            {labOrders.map((order: any, index: number) => (
                                <li key={`order-${index}`}>
                                    {order.testName}
                                    {order.details && <span className="text-slate-500"> — {order.details}</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {labResults.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                        <strong>Resultados de laboratorio:</strong>
                        <ul className="list-disc list-inside">
                            {labResults.map((result: any, index: number) => (
                                <li key={`result-${index}`}>
                                    <span className="font-semibold">{result.testName}</span>
                                    {result.resultValue && <> • {result.resultValue}</>}
                                    {result.unit && <> {result.unit}</>}
                                    {result.referenceRange && <span className="text-slate-500"> (Ref: {result.referenceRange})</span>}
                                    {result.interpretation && <div className="text-slate-500">Interpretación: {result.interpretation}</div>}
                                    {result.notes && <div className="text-slate-500">Notas: {result.notes}</div>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {vitals.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                        <strong>Signos vitales:</strong>
                        <ul className="list-disc list-inside">
                            {vitals.map((vital: any, index: number) => (
                                <li key={`vital-${index}`}>
                                    <span className="font-semibold">{vital.name}:</span> {vital.value}{vital.unit ? ` ${vital.unit}` : ''}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {documents.length > 0 && (
                    <div className="mt-2 text-xs text-slate-600">
                        <strong>Documentos adjuntos:</strong>
                        <ul className="list-disc list-inside">
                            {documents.map((doc: any, index: number) => (
                                <li key={`doc-${index}`}>
                                    {doc.url ? (
                                        <a href={doc.url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                                            {doc.title}
                                        </a>
                                    ) : (
                                        doc.title
                                    )}
                                    {doc.description && <div className="text-slate-500">{doc.description}</div>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex items-center mt-2 text-xs text-gray-500">
                    <EventIcon type={event.type} />
                    <span className="ml-1.5">por {event.actor}</span>
                </div>

                {event.tags && event.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {event.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 text-[10px] bg-teal-100 text-teal-700 rounded-full">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ClinicalTimeline: React.FC<{ timeline: ClinicalTimelineEvent[], patientName: string }> = ({ timeline, patientName }) => {
    const [filter, setFilter] = useState<ClinicalTimelineEvent['type'] | 'All'>('All');

    const filteredTimeline = useMemo(() => {
        if (filter === 'All') return timeline;
        return timeline.filter(event => event.type === filter);
    }, [timeline, filter]);

    const filters: { value: ClinicalTimelineEvent['type'] | 'All', label: string }[] = [
        { value: 'All', label: 'Todo' },
        { value: 'ConsultationNote', label: 'Notas' },
        { value: 'LabResult', label: 'Laboratorios' },
        { value: 'Prescription', label: 'Recetas' },
        { value: 'Vital', label: 'Signos Vitales' },
        { value: 'Document', label: 'Documentos' },
    ];

    return (
        <div className="p-4 flex flex-col h-full">
            <div className="mb-4 flex-shrink-0">
                <h3 className="text-xl font-bold text-gray-800">Historia Clínica</h3>
                <p className="text-sm text-gray-500">{patientName}</p>
            </div>
            <div className="mb-4 flex-shrink-0">
                <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg">
                    {filters.map(f => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={`w-full px-2 py-1 text-sm font-semibold rounded-md transition-colors ${filter === f.value ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 min-h-0">
                 <div className="relative border-l-2 border-slate-200 space-y-4">
                    {filteredTimeline.length > 0 ? filteredTimeline.map(event => (
                        <TimelineEventCard key={event.id} event={event} />
                    )) : <p className="text-center text-gray-500 p-4">No hay eventos para este filtro.</p>}
                 </div>
            </div>
        </div>
    );
};

export default ClinicalTimeline;
