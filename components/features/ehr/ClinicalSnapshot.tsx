import React from 'react';
import { type Patient, type ClinicalSnapshotItem } from '../../../types';

const SnapshotItem: React.FC<{ item: ClinicalSnapshotItem }> = ({ item }) => {
    const baseClasses = "p-3 rounded-md";
    const criticalClasses = "bg-red-100 border-l-4 border-red-500";
    const normalClasses = "bg-slate-50";

    return (
        <div className={`${baseClasses} ${item.isCritical ? criticalClasses : normalClasses}`}>
            <h4 className={`font-bold ${item.isCritical ? 'text-red-800' : 'text-gray-800'}`}>{item.title}</h4>
            <p className={`text-sm ${item.isCritical ? 'text-red-700' : 'text-gray-600'}`}>{item.details}</p>
            {item.date && <p className="text-xs text-gray-400 mt-1">{item.date}</p>}
            {item.source && <p className="text-xs text-gray-500 mt-1">Fuente: {item.source}</p>}
            {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 text-[10px] bg-teal-100 text-teal-700 rounded-full">#{tag}</span>
                    ))}
                </div>
            )}
        </div>
    );
};

const ClinicalSnapshot: React.FC<{ snapshot: ClinicalSnapshotItem[], patient: Patient }> = ({ snapshot, patient }) => {
  return (
    <div className="p-4 flex flex-col h-full">
        <div className="mb-4 flex-shrink-0">
            <div className="flex items-center space-x-3">
                <img src={patient.avatarUrl || `https://i.pravatar.cc/150?u=${patient.id}`} alt="Patient" className="w-12 h-12 rounded-full"/>
                <div>
                    <h3 className="text-xl font-bold text-gray-800">{patient.firstName} {patient.lastName}</h3>
                    <p className="text-sm text-gray-500">{patient.idNumber}</p>
                </div>
            </div>
        </div>
        <div className="flex-grow overflow-y-auto pr-2 min-h-0">
            <div className="space-y-3">
                 {snapshot.length > 0 ? snapshot.map((item, index) => (
                    <SnapshotItem key={index} item={item} />
                )) : <p className="text-center text-gray-500 p-4">No hay información de resumen disponible.</p>}
            </div>
        </div>
    </div>
  );
};

export default ClinicalSnapshot;
