import { mockInvoices } from './mockData';
import { type Invoice, type PaymentDetails, type Appointment } from '../types';

export const getTodaysPaidInvoices = async (): Promise<Invoice[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const today = new Date().toDateString();
    return mockInvoices.filter(inv => {
        if (inv.status !== 'paid' || !inv.paymentDetails) return false;
        
        // Check if any payment was made today
        return inv.paymentDetails.some(p => new Date(p.transactionDate).toDateString() === today);
    });
}

export const getInvoiceById = async (invoiceId: string): Promise<Invoice | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockInvoices.find(inv => inv.id === invoiceId);
}

export const createInvoiceForAppointment = (appointment: Appointment): Invoice => {
    const newInvoice: Invoice = {
        id: `inv-${mockInvoices.length + 1}-${Math.random().toString(36).substr(2, 9)}`,
        patientId: appointment.patient.id,
        date: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: 'draft',
        items: [{ 
            description: appointment.type.name, 
            quantity: 1, 
            unitPrice: appointment.type.price, 
            total: appointment.type.price 
        }],
        subtotal: appointment.type.price,
        tax: 0,
        total: appointment.type.price,
        paymentDetails: []
    };
    return newInvoice;
};


export const updateInvoice = async (invoiceId: string, data: { status: Invoice['status'], payments?: PaymentDetails[] }): Promise<Invoice | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const invoice = mockInvoices.find(inv => inv.id === invoiceId);
    if (invoice) {
        invoice.status = data.status;
        if (data.payments) {
            invoice.paymentDetails = data.payments;
        }
        console.log(`Invoice ${invoiceId} updated:`, invoice);
        return invoice;
    }
    return undefined;
};