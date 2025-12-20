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
exports.getAppointmentAnalyticsHttp = exports.getAppointmentAnalytics = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const utils_1 = require("./utils");
const httpHelpers_1 = require("./httpHelpers");
function ensureDate(value) {
    if (!value)
        return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}
const MAX_RANGE_DAYS = 365;
const getAppointmentAnalyticsHandler = async (data, context) => {
    const { uid, token } = await (0, utils_1.requireAuth)(context, data);
    if (!(0, utils_1.isAdmin)(token)) {
        throw new functions.https.HttpsError('permission-denied', 'Solo los administradores pueden ver las métricas.');
    }
    const endDateInput = ensureDate(data?.endDate) || new Date();
    const startDateInput = ensureDate(data?.startDate);
    const endDate = new Date(endDateInput);
    const startDate = startDateInput ? new Date(startDateInput) : new Date(endDateInput);
    if (!startDateInput) {
        startDate.setDate(endDate.getDate() - 29);
    }
    if (startDate > endDate) {
        throw new functions.https.HttpsError('invalid-argument', 'El rango de fechas es inválido.');
    }
    const rangeMillis = endDate.getTime() - startDate.getTime();
    const computedDays = Math.max(1, Math.round(rangeMillis / (1000 * 60 * 60 * 24)) + 1);
    if (computedDays > MAX_RANGE_DAYS) {
        throw new functions.https.HttpsError('invalid-argument', 'El rango de fechas no puede exceder un año.');
    }
    const rangeDays = computedDays;
    const clinicId = data?.clinicId ? String(data.clinicId) : null;
    let query = utils_1.db
        .collection('appointments')
        .where('startTime', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('startTime', '<=', admin.firestore.Timestamp.fromDate(endDate));
    if (clinicId) {
        query = query.where('clinicId', '==', clinicId);
    }
    const snapshot = await query.get();
    const summary = {
        total: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
    };
    const dailySeriesMap = new Map();
    const typeDistributionMap = new Map();
    const statusDistributionMap = new Map();
    const providerMap = new Map();
    for (const doc of snapshot.docs) {
        const appointment = doc.data();
        const status = String(appointment?.status || 'unknown');
        const startTime = appointment?.startTime && typeof appointment.startTime.toDate === 'function' ? appointment.startTime.toDate() : null;
        const dateKey = startTime ? startTime.toISOString().slice(0, 10) : (0, utils_1.toIsoString)(appointment?.startTime)?.slice(0, 10) || 'unknown';
        summary.total += 1;
        if (status === 'confirmed' || status === 'checked_in' || status === 'in_progress' || status === 'attended_pending_payment') {
            summary.confirmed += 1;
        }
        if (status === 'completed')
            summary.completed += 1;
        if (status === 'cancelled')
            summary.cancelled += 1;
        if (status === 'no_show')
            summary.noShow += 1;
        const dailyEntry = dailySeriesMap.get(dateKey) || { total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 };
        dailyEntry.total += 1;
        if (status === 'confirmed' || status === 'checked_in' || status === 'in_progress' || status === 'attended_pending_payment') {
            dailyEntry.confirmed += 1;
        }
        if (status === 'completed')
            dailyEntry.completed += 1;
        if (status === 'cancelled')
            dailyEntry.cancelled += 1;
        if (status === 'no_show')
            dailyEntry.noShow += 1;
        dailySeriesMap.set(dateKey, dailyEntry);
        const typeId = String(appointment?.typeId || appointment?.typeSnapshot?.id || appointment?.type?.id || 'unknown');
        const typeName = String(appointment?.typeSnapshot?.name || appointment?.type?.name || 'Sin tipo');
        const typeEntry = typeDistributionMap.get(typeId) || { typeId, typeName, count: 0 };
        typeEntry.count += 1;
        typeEntry.typeName = typeName;
        typeDistributionMap.set(typeId, typeEntry);
        statusDistributionMap.set(status, (statusDistributionMap.get(status) || 0) + 1);
        const doctorId = String(appointment?.doctorId || appointment?.doctorSnapshot?.id || appointment?.doctor?.id || 'unknown');
        const doctorName = String(appointment?.doctorSnapshot?.name || appointment?.doctor?.name || 'Sin asignar');
        const providerEntry = providerMap.get(doctorId) || { doctorId, doctorName, count: 0 };
        providerEntry.count += 1;
        providerEntry.doctorName = doctorName;
        providerMap.set(doctorId, providerEntry);
    }
    const dailySeries = Array.from(dailySeriesMap.entries())
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const typeDistribution = Array.from(typeDistributionMap.values()).sort((a, b) => b.count - a.count);
    const statusDistribution = Array.from(statusDistributionMap.entries()).map(([status, count]) => ({ status, count }));
    statusDistribution.sort((a, b) => b.count - a.count);
    const topProviders = Array.from(providerMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    const result = {
        range: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            days: rangeDays,
        },
        summary,
        dailySeries,
        typeDistribution,
        statusDistribution,
        topProviders,
    };
    await (0, utils_1.auditLog)(uid, 'view_appointment_analytics', 'appointments', '*', {
        startDate: result.range.startDate,
        endDate: result.range.endDate,
        clinicId: clinicId || null,
        documentsEvaluated: snapshot.size,
    });
    return result;
};
exports.getAppointmentAnalytics = functions.https.onCall(getAppointmentAnalyticsHandler);
exports.getAppointmentAnalyticsHttp = (0, httpHelpers_1.makeHttpHandler)(getAppointmentAnalyticsHandler);
