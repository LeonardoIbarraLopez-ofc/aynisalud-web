import { type Invoice, type PaymentDetails, type Appointment, type InvoiceItem } from '../types';
import { callBackendFunction } from './functionsClient';

const normalizeInvoice = (raw: any): Invoice => ({
    id: String(raw?.id || ''),
    patientId: String(raw?.patientId || ''),
    appointmentId: raw?.appointmentId ? String(raw.appointmentId) : undefined,
    date: new Date(raw?.date || Date.now()).toISOString(),
    dueDate: new Date(raw?.dueDate || Date.now()).toISOString(),
    status: (['draft', 'sent', 'paid', 'overdue'] as Invoice['status'][]).includes(raw?.status)
        ? raw.status
        : 'draft',
    items: Array.isArray(raw?.items) ? raw.items.map((item: any) => ({
        description: String(item?.description || ''),
        quantity: Number.isFinite(item?.quantity) ? Number(item.quantity) : 0,
        unitPrice: Number.isFinite(item?.unitPrice) ? Number(item.unitPrice) : 0,
        total: Number.isFinite(item?.total) ? Number(item.total) : 0,
    })) : [],
    subtotal: Number.isFinite(raw?.subtotal) ? Number(raw.subtotal) : 0,
    tax: Number.isFinite(raw?.tax) ? Number(raw.tax) : 0,
    total: Number.isFinite(raw?.total) ? Number(raw.total) : 0,
    paymentDetails: Array.isArray(raw?.paymentDetails)
        ? raw.paymentDetails.map((payment: any) => ({
            method: ['Efectivo', 'Tarjeta', 'QR', 'Seguro'].includes(payment?.method)
                ? payment.method
                : 'Efectivo',
            amount: Number(payment?.amount) || 0,
            transactionDate: new Date(payment?.transactionDate || Date.now()).toISOString(),
        }))
        : [],
    lastPaymentAt: raw?.lastPaymentAt ? new Date(raw.lastPaymentAt).toISOString() : raw?.lastPaymentAt ?? undefined,
});

export const getTodaysPaidInvoices = async (): Promise<Invoice[]> => {
    const result = await callBackendFunction<{ invoices?: any[] }>('listPaidInvoicesForToday', {});
    const invoices = (result.invoices || []).map(normalizeInvoice);
    console.debug('[api/billing] getTodaysPaidInvoices ->', invoices.length);
    return invoices;
};

export const getInvoiceById = async (invoiceId: string): Promise<Invoice | undefined> => {
    if (!invoiceId) return undefined;
    const result = await callBackendFunction<{ invoice?: any }>('getInvoiceById', { invoiceId });
    if (!result.invoice) {
        console.warn('[api/billing] getInvoiceById not found', invoiceId);
        return undefined;
    }
    const invoice = normalizeInvoice(result.invoice);
    console.debug('[api/billing] getInvoiceById', invoiceId, 'status', invoice.status);
    return invoice;
};

export const createInvoiceForAppointment = (appointment: Appointment): Invoice => {
    const price = 0;
    return {
        id: `inv-temp-${Date.now()}`,
        patientId: appointment.patient.id,
        appointmentId: appointment.id,
        date: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: 'draft',
        items: [{ description: appointment.type.name, quantity: 1, unitPrice: price, total: price }],
        subtotal: price,
        tax: 0,
        total: price,
        paymentDetails: [],
    };
};


export const updateInvoice = async (
    invoiceId: string,
    data: {
        status: Invoice['status'];
        payments?: PaymentDetails[];
        subtotal?: number;
        tax?: number;
        total?: number;
        items?: InvoiceItem[];
    },
): Promise<Invoice | undefined> => {
    if (!invoiceId) {
        throw new Error('invoiceId requerido');
    }
    const payload: Record<string, any> = {
        invoiceId,
        status: data.status,
        payments: data.payments || [],
    };
    if (data.subtotal !== undefined) payload.subtotal = data.subtotal;
    if (data.tax !== undefined) payload.tax = data.tax;
    if (data.total !== undefined) payload.total = data.total;
    if (data.items !== undefined) payload.items = data.items;
    const result = await callBackendFunction<{ invoice?: any }>('updateInvoice', payload);
    if (!result.invoice) {
        console.warn('[api/billing] updateInvoice sin respuesta', invoiceId);
        return undefined;
    }
    const invoice = normalizeInvoice(result.invoice);
    console.debug('[api/billing] updateInvoice', invoiceId, '->', invoice.status, 'payments', invoice.paymentDetails.length);
    return invoice;
};