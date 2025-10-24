import React from 'react';
import Card from '../../../common/Card';

const AlertItem: React.FC<{ patientName: string; alert: string; time: string; color: string }> = ({ patientName, alert, time, color }) => (
    <div className={`p-3 rounded-md border-l-4 ${color} bg-opacity-20`}>
        <div className="flex justify-between items-start">
            <div>
                <p className="font-bold text-gray-800">{patientName}</p>
                <p className="text-sm text-gray-600">{alert}</p>
            </div>
            <p className="text-xs text-gray-500 flex-shrink-0 ml-2">{time}</p>
        </div>
    </div>
);

const RemoteMonitoringWidget: React.FC = () => {
    return (
        <Card title="Monitoreo Remoto (Últimas 24h)">
            <div className="space-y-3">
                <AlertItem 
                    patientName="Elena Gonzales"
                    alert="Pico de Hipertensión: 165/100 mmHg"
                    time="hace 2 horas"
                    color="border-red-500 bg-red-100"
                />
                 <AlertItem 
                    patientName="Carlos Pérez"
                    alert="Hipoglucemia: 65 mg/dL"
                    time="hace 8 horas"
                    color="border-yellow-500 bg-yellow-100"
                />
            </div>
        </Card>
    );
};

export default RemoteMonitoringWidget;
