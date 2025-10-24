import React, { useState, useEffect, useCallback } from 'react';
import { getTodaysPaidInvoices } from '../../../../api/billing';
import { type Invoice, type PaymentDetails } from '../../../../types';
import { Spinner } from '../../../common/Spinner';
import Card from '../../../common/Card';

const CashboxWidget: React.FC = () => {
    const [total, setTotal] = useState(0);
    const [byMethod, setByMethod] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);

    const loadPayments = useCallback(async () => {
        setIsLoading(true);
        try {
            const paidInvoices = await getTodaysPaidInvoices();
            let totalPaid = 0;
            const paymentsByMethod: Record<string, number> = {};

            paidInvoices.forEach(invoice => {
                if (invoice.paymentDetails) {
                    invoice.paymentDetails.forEach(payment => {
                        totalPaid += payment.amount;
                        paymentsByMethod[payment.method] = (paymentsByMethod[payment.method] || 0) + payment.amount;
                    });
                }
            });
            setTotal(totalPaid);
            setByMethod(paymentsByMethod);
        } catch (error) {
            console.error("Failed to load payments", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center py-4"><Spinner /></div>;
        
        return (
             <div>
                <p className="text-3xl font-bold text-gray-800">Bs. {total.toFixed(2)}</p>
                <p className="text-gray-500 mb-4">Total en tiempo real.</p>
                <div className="space-y-2">
                    {Object.entries(byMethod).map(([method, amount]) => (
                        <div key={method} className="flex justify-between text-sm">
                            <span className="text-gray-600">{method}</span>
                            {/* Fix: Cast `amount` to `number` to resolve TypeScript error where it was inferred as `unknown`. */}
                            <span className="font-semibold text-gray-700">Bs. {(amount as number).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    
    return (
        <Card title="Caja del Día">
            {renderContent()}
        </Card>
    );
};

export default CashboxWidget;
