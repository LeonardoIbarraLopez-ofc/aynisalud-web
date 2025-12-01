import * as functions from 'firebase-functions';
import { requireAuth, db, auditLog, getServerTimestamp, sanitizeForFirestore, toIsoString } from './utils';
import { makeHttpHandler } from './httpHelpers';

type UserRole = 'admin' | 'doctor' | 'specialist' | 'receptionist' | 'patient';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'QR' | 'Seguro';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PaymentDetails {
  method: PaymentMethod;
  amount: number;
  transactionDate: string;
}

interface Invoice {
  id: string;
  patientId: string;
  appointmentId?: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentDetails: PaymentDetails[];
  lastPaymentAt?: string;
}

const VALID_BILLING_ROLES: UserRole[] = ['admin', 'receptionist'];
const ALLOWED_PAYMENT_METHODS: PaymentMethod[] = ['Efectivo', 'Tarjeta', 'QR', 'Seguro'];
const ALLOWED_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];

function ensureBillingAccess(role: UserRole | undefined) {
  if (!role || !VALID_BILLING_ROLES.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Acceso de facturación requerido.');
  }
}

function normalizeInvoiceItem(raw: any): InvoiceItem {
  return {
    description: String(raw?.description || ''),
    quantity: Number.isFinite(raw?.quantity) ? Number(raw.quantity) : 0,
    unitPrice: Number.isFinite(raw?.unitPrice) ? Number(raw.unitPrice) : 0,
    total: Number.isFinite(raw?.total) ? Number(raw.total) : 0,
  };
}

function normalizePaymentDetails(raw: any): PaymentDetails {
  const method: PaymentMethod = ALLOWED_PAYMENT_METHODS.includes(raw?.method) ? raw.method : 'Efectivo';
  const amount = Number(raw?.amount) || 0;
  const iso = toIsoString(raw?.transactionDate) || new Date().toISOString();
  return {
    method,
    amount,
    transactionDate: iso,
  };
}

function normalizeInvoice(raw: any, id: string): Invoice {
  return {
    id,
    patientId: String(raw?.patientId || ''),
    appointmentId: raw?.appointmentId ? String(raw.appointmentId) : undefined,
    date: toIsoString(raw?.date) || new Date().toISOString(),
    dueDate: toIsoString(raw?.dueDate) || new Date().toISOString(),
    status: ALLOWED_STATUSES.includes(raw?.status) ? raw.status : 'draft',
    items: Array.isArray(raw?.items) ? raw.items.map(normalizeInvoiceItem) : [],
    subtotal: Number(raw?.subtotal) || 0,
    tax: Number(raw?.tax) || 0,
    total: Number(raw?.total) || 0,
    paymentDetails: Array.isArray(raw?.paymentDetails) ? raw.paymentDetails.map(normalizePaymentDetails) : [],
    lastPaymentAt: toIsoString(raw?.lastPaymentAt),
  };
}

function validateAndNormalizePayments(payments: any[]): PaymentDetails[] {
  if (!Array.isArray(payments)) return [];
  return payments.map((payment, index) => {
    const method = payment?.method;
    if (!ALLOWED_PAYMENT_METHODS.includes(method)) {
      throw new functions.https.HttpsError('invalid-argument', `Método de pago inválido en posición ${index}.`);
    }
    const amount = Number(payment?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new functions.https.HttpsError('invalid-argument', `Monto inválido en posición ${index}.`);
    }
    const dateIso = toIsoString(payment?.transactionDate) || new Date().toISOString();
    return {
      method,
      amount,
      transactionDate: dateIso,
    };
  });
}

const listPaidInvoicesForTodayHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensureBillingAccess(token?.role as UserRole | undefined);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  console.log('[listPaidInvoicesForToday] window', startOfDay.toISOString(), endOfDay.toISOString());

  const snap = await db
    .collection('invoices')
    .where('status', '==', 'paid')
    .limit(200)
    .get();

  const invoices = snap.docs.map(doc => normalizeInvoice({ ...doc.data(), id: doc.id }, doc.id));
  const filtered = invoices
    .filter(inv => {
      const dates = (inv.paymentDetails || []).map(p => new Date(p.transactionDate));
      if (inv.lastPaymentAt) {
        dates.push(new Date(inv.lastPaymentAt));
      }
      return dates.some(date => date >= startOfDay && date < endOfDay);
    })
    .sort((a, b) => {
      const aDate = a.lastPaymentAt ? new Date(a.lastPaymentAt).getTime() : 0;
      const bDate = b.lastPaymentAt ? new Date(b.lastPaymentAt).getTime() : 0;
      return bDate - aDate;
    });

  console.log('[listPaidInvoicesForToday] returning', filtered.length, 'invoices');
  return { invoices: filtered };
};

export const listPaidInvoicesForToday = functions.https.onCall(listPaidInvoicesForTodayHandler);
export const listPaidInvoicesForTodayHttp = makeHttpHandler(listPaidInvoicesForTodayHandler);

const getInvoiceByIdHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensureBillingAccess(token?.role as UserRole | undefined);

  const invoiceId: string = String(data?.invoiceId || '').trim();
  if (!invoiceId) {
    throw new functions.https.HttpsError('invalid-argument', 'invoiceId requerido.');
  }

  const doc = await db.doc(`invoices/${invoiceId}`).get();
  if (!doc.exists) {
    throw new functions.https.HttpsError('not-found', 'Factura no encontrada.');
  }

  const invoice = normalizeInvoice({ ...doc.data(), id: doc.id }, doc.id);
  console.log('[getInvoiceById] invoice', invoiceId, 'status', invoice.status, 'payments', invoice.paymentDetails.length);
  return { invoice };
};

export const getInvoiceById = functions.https.onCall(getInvoiceByIdHandler);
export const getInvoiceByIdHttp = makeHttpHandler(getInvoiceByIdHandler);

const updateInvoiceHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  ensureBillingAccess(token?.role as UserRole | undefined);

  console.log('[updateInvoice] raw payload', JSON.stringify(data));

  const invoiceId: string = String(data?.invoiceId || '').trim();
  if (!invoiceId) {
    throw new functions.https.HttpsError('invalid-argument', 'invoiceId requerido.');
  }

  const status: InvoiceStatus | undefined = data?.status;
  if (status && !ALLOWED_STATUSES.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Estado de factura inválido.');
  }

  const payments = validateAndNormalizePayments(data?.payments || []);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  console.log('[updateInvoice] normalized payments', payments.length, 'totalPaid', totalPaid);

  if (!status && payments.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'No hay datos para actualizar.');
  }

  const docRef = db.doc(`invoices/${invoiceId}`);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Factura no encontrada.');
  }

  const updates: Record<string, any> = {
    updatedAt: getServerTimestamp(),
  };

  if (status) {
    updates.status = status;
  }

  if (data?.subtotal !== undefined) {
    const subtotal = Number(data.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Subtotal inválido.');
    }
    updates.subtotal = subtotal;
  }

  if (data?.tax !== undefined) {
    const tax = Number(data.tax);
    if (!Number.isFinite(tax) || tax < 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Impuesto inválido.');
    }
    updates.tax = tax;
  }

  if (data?.total !== undefined) {
    const total = Number(data.total);
    if (!Number.isFinite(total) || total < 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Total inválido.');
    }
    updates.total = total;
  }

  if (data?.items !== undefined) {
    if (!Array.isArray(data.items)) {
      throw new functions.https.HttpsError('invalid-argument', 'Items de factura inválidos.');
    }
    updates.items = data.items.map(normalizeInvoiceItem);
  }

  if (data?.payments !== undefined) {
    updates.paymentDetails = payments;
    if (payments.length > 0) {
      const latestPaymentDate = payments
        .map(p => new Date(p.transactionDate))
        .reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
      updates.lastPaymentAt = latestPaymentDate.toISOString();
    } else {
      updates.lastPaymentAt = null;
    }
  }

  const sanitized = sanitizeForFirestore(updates);
  console.log('[updateInvoice] updates', sanitized);
  await docRef.set(sanitized, { merge: true });

  await auditLog(uid as string, 'update_invoice', 'invoices', invoiceId, {
    status,
    paymentsCount: payments.length,
    totalPaid,
  });

  const refreshed = await docRef.get();
  const invoice = normalizeInvoice({ ...refreshed.data(), id: refreshed.id }, refreshed.id);
  console.log('[updateInvoice] success', invoiceId, 'status', invoice.status);

  return { invoice };
};

export const updateInvoice = functions.https.onCall(updateInvoiceHandler);
export const updateInvoiceHttp = makeHttpHandler(updateInvoiceHandler);
