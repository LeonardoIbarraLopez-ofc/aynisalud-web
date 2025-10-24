import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../common/Modal';
import { Spinner } from '../../common/Spinner';
import { type Appointment, type Invoice, type PaymentDetails } from '../../../types';
import { getInvoiceById, updateInvoice } from '../../../api/billing';
import { updateAppointmentStatus } from '../../../api/appointments';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onCheckoutComplete: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, appointment, onCheckoutComplete }) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payments, setPayments] = useState<PaymentDetails[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentDetails['method']>('Efectivo');
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    if (isOpen && appointment.associatedInvoiceId) {
      setIsLoading(true);
      setError(null);
      setPayments([]);
      getInvoiceById(appointment.associatedInvoiceId)
        .then(inv => {
          if (inv) {
            setInvoice(inv);
            setPayments(inv.paymentDetails || []);
          } else {
            setError('No se pudo encontrar la factura asociada.');
          }
        })
        .catch(() => setError('Error al cargar la factura.'))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, appointment]);

  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
  const balanceDue = useMemo(() => (invoice?.total ?? 0) - totalPaid, [invoice, totalPaid]);

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || amount > balanceDue) {
      alert('Por favor ingrese un monto válido.');
      return;
    }

    setPayments(prev => [...prev, {
      method: paymentMethod,
      amount,
      transactionDate: new Date().toISOString()
    }]);
    setPaymentAmount('');
  };
  
  const handleRemovePayment = (index: number) => {
      setPayments(prev => prev.filter((_, i) => i !== index));
  }

  const handleFinalizeCheckout = async (payLater: boolean = false) => {
      if (!invoice) return;
      setIsSubmitting(true);
      setError(null);
      try {
          const invoiceStatus = payLater ? 'sent' : 'paid';
          await updateInvoice(invoice.id, { status: invoiceStatus, payments });
          await updateAppointmentStatus(appointment.id, 'completed');
          onCheckoutComplete();
      } catch (err) {
          setError('Ocurrió un error al procesar el pago. Por favor, intente de nuevo.');
          console.error(err);
      } finally {
          setIsSubmitting(false);
      }
  }

  const renderContent = () => {
    if (isLoading) {
      return <div className="flex justify-center items-center h-48"><Spinner /></div>;
    }
    if (error) {
      return <p className="text-red-500 p-4">{error}</p>;
    }
    if (!invoice) {
      return <p className="text-gray-500 p-4">No hay información de factura disponible.</p>;
    }

    return (
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-lg">{appointment.patient.firstName} {appointment.patient.lastName}</p>
          <p className="text-sm text-gray-600">{invoice.items[0].description}</p>
        </div>

        <div className="p-4 bg-slate-100 rounded-lg text-center">
            <p className="text-sm text-gray-500">MONTO TOTAL</p>
            <p className="text-4xl font-bold text-gray-800">Bs. {invoice.total.toFixed(2)}</p>
        </div>
        
        {/* Payment List */}
        <div className="space-y-2">
            <h4 className="font-semibold text-gray-700">Pagos registrados</h4>
            {payments.length > 0 ? (
                payments.map((p, i) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                        <span>{p.method}</span>
                        <span className="font-semibold">Bs. {p.amount.toFixed(2)}</span>
                        <button onClick={() => handleRemovePayment(i)} className="text-red-500 hover:text-red-700 text-xs">Quitar</button>
                    </div>
                ))
            ) : (
                <p className="text-sm text-gray-500 italic">Aún no se han añadido pagos.</p>
            )}
        </div>

        {/* Balance */}
        <div className={`p-3 rounded-lg text-center ${balanceDue > 0 ? 'bg-yellow-100' : 'bg-green-100'}`}>
            <p className="text-sm font-medium">{balanceDue > 0 ? 'SALDO PENDIENTE' : 'COMPLETADO'}</p>
            <p className="text-2xl font-bold">{balanceDue > 0 ? `Bs. ${balanceDue.toFixed(2)}` : 'Bs. 0.00'}</p>
        </div>

        {/* Add Payment Form */}
        {balanceDue > 0 && (
            <form onSubmit={handleAddPayment} className="grid grid-cols-3 gap-2 p-3 border rounded-md">
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentDetails['method'])} className="col-span-1 p-2 border rounded-md">
                    <option>Efectivo</option>
                    <option>Tarjeta</option>
                    <option>QR</option>
                    <option>Seguro</option>
                </select>
                <input
                    type="number"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    placeholder="Monto"
                    className="col-span-1 p-2 border rounded-md"
                    step="0.01"
                    max={balanceDue}
                />
                 <button type="submit" className="col-span-1 bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600">Añadir Pago</button>
            </form>
        )}
      </div>
    );
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Proceso de Check-out y Cobro" size="md">
        <div className="p-1">
            {renderContent()}

            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
            
            <div className="flex justify-between items-center pt-4 border-t mt-6">
                <button 
                    onClick={() => handleFinalizeCheckout(true)}
                    disabled={isSubmitting || balanceDue <= 0}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Procesando...' : 'Pagar Después'}
                </button>
                <button 
                    onClick={() => handleFinalizeCheckout(false)} 
                    disabled={isSubmitting || balanceDue > 0} 
                    className="bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed">
                     {isSubmitting ? 'Procesando...' : 'Confirmar Pago'}
                </button>
            </div>
        </div>
    </Modal>
  );
};

export default CheckoutModal;
