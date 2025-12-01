"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInvoiceHttp = exports.updateInvoice = exports.getInvoiceByIdHttp = exports.getInvoiceById = exports.listPaidInvoicesForTodayHttp = exports.listPaidInvoicesForToday = void 0;
const functions = __importStar(require("firebase-functions"));
const utils_1 = require("./utils");
const httpHelpers_1 = require("./httpHelpers");
const VALID_BILLING_ROLES = ['admin', 'receptionist'];
const ALLOWED_PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'QR', 'Seguro'];
const ALLOWED_STATUSES = ['draft', 'sent', 'paid', 'overdue'];
function ensureBillingAccess(role) {
    if (!role || !VALID_BILLING_ROLES.includes(role)) {
        throw new functions.https.HttpsError('permission-denied', 'Acceso de facturación requerido.');
    }
}
function normalizeInvoiceItem(raw) {
    return {
        description: String(raw?.description || ''),
        quantity: Number.isFinite(raw?.quantity) ? Number(raw.quantity) : 0,
        unitPrice: Number.isFinite(raw?.unitPrice) ? Number(raw.unitPrice) : 0,
        total: Number.isFinite(raw?.total) ? Number(raw.total) : 0,
    };
}
function normalizePaymentDetails(raw) {
    const method = ALLOWED_PAYMENT_METHODS.includes(raw?.method) ? raw.method : 'Efectivo';
    const amount = Number(raw?.amount) || 0;
    const iso = (0, utils_1.toIsoString)(raw?.transactionDate) || new Date().toISOString();
    return {
        method,
        amount,
        transactionDate: iso,
    };
}
function normalizeInvoice(raw, id) {
    return {
        id,
        patientId: String(raw?.patientId || ''),
        appointmentId: raw?.appointmentId ? String(raw.appointmentId) : undefined,
        date: (0, utils_1.toIsoString)(raw?.date) || new Date().toISOString(),
        dueDate: (0, utils_1.toIsoString)(raw?.dueDate) || new Date().toISOString(),
        status: ALLOWED_STATUSES.includes(raw?.status) ? raw.status : 'draft',
        items: Array.isArray(raw?.items) ? raw.items.map(normalizeInvoiceItem) : [],
        subtotal: Number(raw?.subtotal) || 0,
        tax: Number(raw?.tax) || 0,
        total: Number(raw?.total) || 0,
        paymentDetails: Array.isArray(raw?.paymentDetails) ? raw.paymentDetails.map(normalizePaymentDetails) : [],
        lastPaymentAt: (0, utils_1.toIsoString)(raw?.lastPaymentAt),
    };
}
function validateAndNormalizePayments(payments) {
    if (!Array.isArray(payments))
        return [];
    return payments.map((payment, index) => {
        const method = payment?.method;
        if (!ALLOWED_PAYMENT_METHODS.includes(method)) {
            throw new functions.https.HttpsError('invalid-argument', `Método de pago inválido en posición ${index}.`);
        }
        const amount = Number(payment?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new functions.https.HttpsError('invalid-argument', `Monto inválido en posición ${index}.`);
        }
        const dateIso = (0, utils_1.toIsoString)(payment?.transactionDate) || new Date().toISOString();
        return {
            method,
            amount,
            transactionDate: dateIso,
        };
    });
}
const listPaidInvoicesForTodayHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensureBillingAccess(token?.role);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    console.log('[listPaidInvoicesForToday] window', startOfDay.toISOString(), endOfDay.toISOString());
    const snap = await utils_1.db
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
exports.listPaidInvoicesForToday = functions.https.onCall(listPaidInvoicesForTodayHandler);
exports.listPaidInvoicesForTodayHttp = (0, httpHelpers_1.makeHttpHandler)(listPaidInvoicesForTodayHandler);
const getInvoiceByIdHandler = async (data, context) => {
    const { token } = await (0, utils_1.requireAuth)(context, data);
    ensureBillingAccess(token?.role);
    const invoiceId = String(data?.invoiceId || '').trim();
    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'invoiceId requerido.');
    }
    const doc = await utils_1.db.doc(`invoices/${invoiceId}`).get();
    if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Factura no encontrada.');
    }
    const invoice = normalizeInvoice({ ...doc.data(), id: doc.id }, doc.id);
    console.log('[getInvoiceById] invoice', invoiceId, 'status', invoice.status, 'payments', invoice.paymentDetails.length);
    return { invoice };
};
exports.getInvoiceById = functions.https.onCall(getInvoiceByIdHandler);
exports.getInvoiceByIdHttp = (0, httpHelpers_1.makeHttpHandler)(getInvoiceByIdHandler);
const updateInvoiceHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    ensureBillingAccess(token?.role);
    console.log('[updateInvoice] raw payload', JSON.stringify(data));
    const invoiceId = String(data?.invoiceId || '').trim();
    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'invoiceId requerido.');
    }
    const status = data?.status;
    if (status && !ALLOWED_STATUSES.includes(status)) {
        throw new functions.https.HttpsError('invalid-argument', 'Estado de factura inválido.');
    }
    const payments = validateAndNormalizePayments(data?.payments || []);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    console.log('[updateInvoice] normalized payments', payments.length, 'totalPaid', totalPaid);
    if (!status && payments.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No hay datos para actualizar.');
    }
    const docRef = utils_1.db.doc(`invoices/${invoiceId}`);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Factura no encontrada.');
    }
    const updates = {
        updatedAt: (0, utils_1.getServerTimestamp)(),
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
        }
        else {
            updates.lastPaymentAt = null;
        }
    }
    const sanitized = (0, utils_1.sanitizeForFirestore)(updates);
    console.log('[updateInvoice] updates', sanitized);
    await docRef.set(sanitized, { merge: true });
    await (0, utils_1.auditLog)(uid, 'update_invoice', 'invoices', invoiceId, {
        status,
        paymentsCount: payments.length,
        totalPaid,
    });
    const refreshed = await docRef.get();
    const invoice = normalizeInvoice({ ...refreshed.data(), id: refreshed.id }, refreshed.id);
    console.log('[updateInvoice] success', invoiceId, 'status', invoice.status);
    return { invoice };
};
exports.updateInvoice = functions.https.onCall(updateInvoiceHandler);
exports.updateInvoiceHttp = (0, httpHelpers_1.makeHttpHandler)(updateInvoiceHandler);
