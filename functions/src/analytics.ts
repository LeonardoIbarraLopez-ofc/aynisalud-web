import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { requireAuth, isAdmin, db, auditLog, toIsoString } from './utils';
import { makeHttpHandler } from './httpHelpers';

interface AppointmentAnalyticsResult {
  range: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summary: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  dailySeries: Array<{
    date: string;
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }>;
  typeDistribution: Array<{
    typeId: string;
    typeName: string;
    count: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
  }>;
  topProviders: Array<{
    doctorId: string;
    doctorName: string;
    count: number;
  }>;
}

function ensureDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

const MAX_RANGE_DAYS = 365;

const getAppointmentAnalyticsHandler = async (data: any, context: any): Promise<AppointmentAnalyticsResult> => {
  const { uid, token } = await requireAuth(context, data);
  if (!isAdmin(token)) {
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

  let query = db
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

  const dailySeriesMap = new Map<string, { total: number; confirmed: number; completed: number; cancelled: number; noShow: number }>();
  const typeDistributionMap = new Map<string, { typeId: string; typeName: string; count: number }>();
  const statusDistributionMap = new Map<string, number>();
  const providerMap = new Map<string, { doctorId: string; doctorName: string; count: number }>();

  for (const doc of snapshot.docs) {
    const appointment = doc.data() as any;
    const status: string = String(appointment?.status || 'unknown');
    const startTime = appointment?.startTime && typeof appointment.startTime.toDate === 'function' ? appointment.startTime.toDate() : null;
    const dateKey = startTime ? startTime.toISOString().slice(0, 10) : toIsoString(appointment?.startTime)?.slice(0, 10) || 'unknown';

    summary.total += 1;
    if (status === 'confirmed' || status === 'checked_in' || status === 'in_progress' || status === 'attended_pending_payment') {
      summary.confirmed += 1;
    }
    if (status === 'completed') summary.completed += 1;
    if (status === 'cancelled') summary.cancelled += 1;
    if (status === 'no_show') summary.noShow += 1;

    const dailyEntry = dailySeriesMap.get(dateKey) || { total: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 };
    dailyEntry.total += 1;
    if (status === 'confirmed' || status === 'checked_in' || status === 'in_progress' || status === 'attended_pending_payment') {
      dailyEntry.confirmed += 1;
    }
    if (status === 'completed') dailyEntry.completed += 1;
    if (status === 'cancelled') dailyEntry.cancelled += 1;
    if (status === 'no_show') dailyEntry.noShow += 1;
    dailySeriesMap.set(dateKey, dailyEntry);

    const typeId: string = String(appointment?.typeId || appointment?.typeSnapshot?.id || appointment?.type?.id || 'unknown');
    const typeName: string = String(appointment?.typeSnapshot?.name || appointment?.type?.name || 'Sin tipo');
    const typeEntry = typeDistributionMap.get(typeId) || { typeId, typeName, count: 0 };
    typeEntry.count += 1;
    typeEntry.typeName = typeName;
    typeDistributionMap.set(typeId, typeEntry);

    statusDistributionMap.set(status, (statusDistributionMap.get(status) || 0) + 1);

    const doctorId: string = String(appointment?.doctorId || appointment?.doctorSnapshot?.id || appointment?.doctor?.id || 'unknown');
    const doctorName: string = String(appointment?.doctorSnapshot?.name || appointment?.doctor?.name || 'Sin asignar');
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

  const result: AppointmentAnalyticsResult = {
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

  await auditLog(uid as string, 'view_appointment_analytics', 'appointments', '*', {
    startDate: result.range.startDate,
    endDate: result.range.endDate,
    clinicId: clinicId || null,
    documentsEvaluated: snapshot.size,
  });

  return result;
};

export const getAppointmentAnalytics = functions.https.onCall(getAppointmentAnalyticsHandler);
export const getAppointmentAnalyticsHttp = makeHttpHandler(getAppointmentAnalyticsHandler);
