import React from 'react';
import Card from '../../../common/Card';

const InboxItem: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; badge?: string; badgeColor?: string }> = ({ icon, title, subtitle, badge, badgeColor }) => (
    <div className="flex items-center space-x-3 hover:bg-slate-50 p-2 rounded-md cursor-pointer">
        <div className="flex-shrink-0 text-slate-500">{icon}</div>
        <div className="flex-grow">
            <p className="font-semibold text-gray-800">{title}</p>
            <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {badge && <span className={`px-2 py-0.5 text-xs font-bold text-white rounded-full ${badgeColor}`}>{badge}</span>}
    </div>
);


const UnifiedInboxWidget: React.FC = () => {
    return (
        <Card title="Bandeja de Entrada Unificada">
            <div className="space-y-2">
                <InboxItem 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    title="Resultados de Laboratorio por Revisar"
                    subtitle="Carlos Pérez y 3 más"
                    badge="2"
                    badgeColor="bg-red-500"
                />
                 <InboxItem 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    title="Renovaciones de Recetas Pendientes"
                    subtitle="Elena Gonzales"
                />
                 <InboxItem 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                    title="Informes de Interconsulta Recibidos"
                    subtitle="De Dra. Rojas (Cardiología)"
                />
            </div>
        </Card>
    );
};

export default UnifiedInboxWidget;
