import React from 'react';
import { type Patient } from '../../../../types';
import Card from '../../../common/Card';

interface PatientHealthSummaryWidgetProps {
    patient: Patient;
}

const SummaryItem: React.FC<{ title: string, items: string[], isCritical?: boolean }> = ({ title, items, isCritical }) => {
    if (items.length === 0) return null;

    const textColor = isCritical ? 'text-red-800' : 'text-slate-800';
    const bgColor = isCritical ? 'bg-red-50' : 'bg-slate-50';

    return (
        <div>
            <h4 className="font-semibold text-gray-600 mb-1">{title}</h4>
            <ul className="space-y-1">
                {items.map((item, index) => (
                    <li key={index} className={`text-sm font-medium p-2 rounded-md ${textColor} ${bgColor}`}>
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    )
}

const PatientHealthSummaryWidget: React.FC<PatientHealthSummaryWidgetProps> = ({ patient }) => {
    return (
        <Card title="Resumen de Salud">
            <div className="space-y-4">
                <SummaryItem title="Alergias Conocidas" items={patient.allergies} isCritical={true} />
                <SummaryItem title="Condiciones Crónicas" items={patient.chronicConditions} />
            </div>
        </Card>
    );
};

export default PatientHealthSummaryWidget;
