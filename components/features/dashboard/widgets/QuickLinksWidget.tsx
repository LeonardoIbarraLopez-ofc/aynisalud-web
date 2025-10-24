import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../common/Card';

const QuickLink: React.FC<{ to: string, icon: React.ReactNode, text: string }> = ({ to, icon, text }) => (
    <Link to={to} className="flex items-center p-3 text-gray-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
        <div className="mr-3 text-slate-500">{icon}</div>
        <span className="font-semibold">{text}</span>
    </Link>
);


const QuickLinksWidget: React.FC = () => {
    return (
        <Card title="Acciones Rápidas">
            <div className="space-y-2">
                <QuickLink
                    to="/mis-citas"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    text="Ver todas mis citas"
                />
                <QuickLink
                    to="/historial"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    text="Mi historial médico"
                />
                <QuickLink
                    to="/facturacion"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    text="Historial de pagos"
                />
            </div>
        </Card>
    );
};

export default QuickLinksWidget;
