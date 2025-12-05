import React from 'react';
import Card from '../../common/Card';
import { Spinner } from '../../common/Spinner';
import { type Invoice } from '../../../types';

interface PatientInvoicesWidgetProps {
  pendingInvoices: Invoice[];
  recentInvoices: Invoice[];
  isLoading: boolean;
  onInvoiceSelected?: (invoiceId: string) => void;
}

const formatAmount = (amount: number): string => {
  return `Bs. ${amount.toFixed(2)}`;
};

const StatusPill: React.FC<{ status: Invoice['status'] }> = ({ status }) => {
  const statusMap: Record<Invoice['status'], { label: string; classes: string }> = {
    draft: { label: 'Borrador', classes: 'bg-slate-100 text-slate-700' },
    sent: { label: 'Pendiente', classes: 'bg-yellow-100 text-yellow-800' },
    paid: { label: 'Pagada', classes: 'bg-green-100 text-green-800' },
    overdue: { label: 'Vencida', classes: 'bg-red-100 text-red-700' },
  };
  const info = statusMap[status] || statusMap.sent;
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${info.classes}`}>{info.label}</span>;
};

const PendingInvoiceRow: React.FC<{ invoice: Invoice; onSelect?: (invoiceId: string) => void }> = ({ invoice, onSelect }) => {
  const dueDate = new Date(invoice.dueDate).toLocaleDateString();
  return (
    <button
      onClick={() => onSelect && onSelect(invoice.id)}
      className="w-full text-left p-3 bg-white rounded-md border border-slate-200 hover:border-teal-400 hover:shadow-sm transition"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Factura #{invoice.id}</p>
          <p className="text-xs text-slate-500">Vence: {dueDate}</p>
        </div>
        <div className="flex items-center space-x-3">
          <StatusPill status={invoice.status} />
          <span className="text-sm font-semibold text-slate-800">{formatAmount(invoice.total)}</span>
        </div>
      </div>
    </button>
  );
};

const HistoryInvoiceRow: React.FC<{ invoice: Invoice }> = ({ invoice }) => {
  const paidAt = invoice.lastPaymentAt ? new Date(invoice.lastPaymentAt) : null;
  const paidLabel = paidAt ? paidAt.toLocaleDateString() : 'Sin pagos';
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div>
        <p className="text-sm font-medium text-slate-700">#{invoice.id}</p>
        <p className="text-xs text-slate-500">Emitida: {new Date(invoice.date).toLocaleDateString()}</p>
      </div>
      <div className="text-right">
        <StatusPill status={invoice.status} />
        <p className="text-sm font-semibold text-slate-800">{formatAmount(invoice.total)}</p>
        <p className="text-xs text-slate-500">Último movimiento: {paidLabel}</p>
      </div>
    </div>
  );
};

const PatientInvoicesWidget: React.FC<PatientInvoicesWidgetProps> = ({ pendingInvoices, recentInvoices, isLoading, onInvoiceSelected }) => {
  return (
    <Card title="Facturación y Pagos">
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Por pagar</h4>
            <div className="space-y-2 mt-2">
              {pendingInvoices.length === 0 && <p className="text-sm text-slate-500">No tiene pagos pendientes.</p>}
              {pendingInvoices.map(invoice => (
                <PendingInvoiceRow key={invoice.id} invoice={invoice} onSelect={onInvoiceSelected} />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Historial reciente</h4>
            <div className="mt-2">
              {recentInvoices.length === 0 && <p className="text-sm text-slate-500">Aún no se registran pagos.</p>}
              {recentInvoices.map(invoice => (
                <HistoryInvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PatientInvoicesWidget;
