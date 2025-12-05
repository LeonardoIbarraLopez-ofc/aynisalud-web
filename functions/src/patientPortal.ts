import * as functions from 'firebase-functions';
import { requireAuth, db, toIsoString } from './utils';
import { makeHttpHandler } from './httpHelpers';

type UserRole = 'admin' | 'doctor' | 'specialist' | 'receptionist' | 'patient';

type AppointmentStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'attended_pending_payment'
  | 'completed'
  | 'cancelled'
  | 'no_show';

interface PatientContactInfo {
  email: string;
  phone: string;
  address: string;
}

interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  idNumber: string;
  contactInfo: PatientContactInfo;
  insuranceInfo: any[];
  allergies: string[];
  chronicConditions: string[];
  avatarUrl?: string;
}

interface AppointmentTypeSummary {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description?: string;
}

interface DoctorSummary {
  id: string;
  name: string;
  email?: string;
  role?: string;
  phone?: string;
  avatarUrl?: string;
}

interface AppointmentSummary {
  id: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  type: AppointmentTypeSummary;
  doctor: DoctorSummary;
  associatedInvoiceId?: string;
}

interface PaymentDetailsSummary {
  method: string;
  amount: number;
  transactionDate: string;
}

interface InvoiceSummary {
  id: string;
  patientId: string;
  appointmentId?: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  subtotal: number;
  tax: number;
  total: number;
  paymentDetails: PaymentDetailsSummary[];
  lastPaymentAt?: string | null;
}

function ensurePatientRole(role: UserRole | undefined) {
  if (!role) {
    throw new functions.https.HttpsError('permission-denied', 'Autenticación requerida.');
  }
  const allowed: UserRole[] = ['patient', 'admin', 'receptionist'];
  if (!allowed.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'No autorizado para ver el portal del paciente.');
  }
}

function normalizePatientProfile(raw: FirebaseFirestore.DocumentSnapshot): PatientProfile {
  const data = raw.data() as any;
  return {
    id: raw.id,
    firstName: String(data?.firstName || ''),
    lastName: String(data?.lastName || ''),
    dob: String(data?.dob || ''),
    gender: ['male', 'female', 'other'].includes(data?.gender) ? data.gender : 'other',
    idNumber: String(data?.idNumber || ''),
    contactInfo: {
      email: String(data?.contactInfo?.email || ''),
      phone: String(data?.contactInfo?.phone || ''),
      address: String(data?.contactInfo?.address || ''),
    },
    insuranceInfo: Array.isArray(data?.insuranceInfo) ? data.insuranceInfo : [],
    allergies: Array.isArray(data?.allergies) ? data.allergies : [],
    chronicConditions: Array.isArray(data?.chronicConditions) ? data.chronicConditions : [],
    avatarUrl: data?.avatarUrl || undefined,
  };
}

function normalizeAppointmentSummary(raw: FirebaseFirestore.DocumentSnapshot): AppointmentSummary {
  const data = raw.data() as any;
  const startIso = toIsoString(data?.startTime) || new Date().toISOString();
  const endIso = toIsoString(data?.endTime) || startIso;

  const typeSnapshot = data?.typeSnapshot || data?.type || {};
  const doctorSnapshot = data?.doctorSnapshot || data?.doctor || {};

  const type: AppointmentTypeSummary = {
    id: String(typeSnapshot?.id || data?.typeId || ''),
    name: String(typeSnapshot?.name || ''),
    durationMinutes: Number.isFinite(typeSnapshot?.durationMinutes) ? Number(typeSnapshot.durationMinutes) : 30,
    price: Number.isFinite(typeSnapshot?.price) ? Number(typeSnapshot.price) : 0,
    description: typeSnapshot?.description || '',
  };

  const doctor: DoctorSummary = {
    id: String(doctorSnapshot?.id || data?.doctorId || ''),
    name: String(doctorSnapshot?.name || ''),
    email: doctorSnapshot?.email || undefined,
    role: doctorSnapshot?.role || undefined,
    phone: doctorSnapshot?.phone || undefined,
    avatarUrl: doctorSnapshot?.avatarUrl || undefined,
  };

  const status: AppointmentStatus = (
    [
      'pending_confirmation',
      'confirmed',
      'checked_in',
      'in_progress',
      'attended_pending_payment',
      'completed',
      'cancelled',
      'no_show',
    ] as AppointmentStatus[]
  ).includes(data?.status)
    ? data.status
    : 'confirmed';

  return {
    id: raw.id,
    startTime: startIso,
    endTime: endIso,
    status,
    notes: data?.notes || undefined,
    type,
    doctor,
    associatedInvoiceId: data?.associatedInvoiceId || undefined,
  };
}

function normalizeInvoiceSummary(raw: FirebaseFirestore.DocumentSnapshot): InvoiceSummary {
  const data = raw.data() as any;
  return {
    id: raw.id,
    patientId: String(data?.patientId || ''),
    appointmentId: data?.appointmentId ? String(data.appointmentId) : undefined,
    date: toIsoString(data?.date) || new Date().toISOString(),
    dueDate: toIsoString(data?.dueDate) || new Date().toISOString(),
    status: (['draft', 'sent', 'paid', 'overdue'] as InvoiceSummary['status'][]).includes(data?.status)
      ? data.status
      : 'draft',
    subtotal: Number.isFinite(data?.subtotal) ? Number(data.subtotal) : 0,
    tax: Number.isFinite(data?.tax) ? Number(data.tax) : 0,
    total: Number.isFinite(data?.total) ? Number(data.total) : 0,
    paymentDetails: Array.isArray(data?.paymentDetails)
      ? data.paymentDetails.map((payment: any) => ({
          method: String(payment?.method || 'Efectivo'),
          amount: Number(payment?.amount) || 0,
          transactionDate: toIsoString(payment?.transactionDate) || new Date().toISOString(),
        }))
      : [],
    lastPaymentAt: toIsoString(data?.lastPaymentAt) || null,
  };
}

const getPatientPortalOverviewHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  ensurePatientRole(token?.role as UserRole | undefined);

  let patientDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  const requestedPatientId: string | undefined = data?.patientId ? String(data.patientId) : undefined;

  if (requestedPatientId && token?.role !== 'patient') {
    const snap = await db.doc(`patients/${requestedPatientId}`).get();
    if (snap.exists) {
      patientDoc = snap;
    }
  }

  if (!patientDoc) {
    const snap = await db.collection('patients').where('authUid', '==', uid).limit(1).get();
    if (snap.empty) {
      throw new functions.https.HttpsError('not-found', 'No se encontró un perfil de paciente.');
    }
    patientDoc = snap.docs[0];
  }

  const patient = normalizePatientProfile(patientDoc);

  const appointmentsSnap = await db
    .collection('appointments')
    .where('patientId', '==', patient.id)
    .orderBy('startTime', 'asc')
    .limit(25)
    .get();

  const now = Date.now();
  const upcomingAppointments = appointmentsSnap.docs
    .map(normalizeAppointmentSummary)
    .filter(apt => new Date(apt.endTime).getTime() >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);

  const invoicesSnap = await db
    .collection('invoices')
    .where('patientId', '==', patient.id)
    .limit(25)
    .get();

  const invoices = invoicesSnap.docs.map(normalizeInvoiceSummary);
  const pendingInvoices = invoices
    .filter(inv => inv.status !== 'paid')
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
    .slice(0, 5);
  const recentInvoices = invoices
    .sort((a, b) => {
      const aTime = a.lastPaymentAt ? new Date(a.lastPaymentAt).getTime() : new Date(a.date).getTime();
      const bTime = b.lastPaymentAt ? new Date(b.lastPaymentAt).getTime() : new Date(b.date).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  return {
    patient,
    upcomingAppointments,
    pendingInvoices,
    recentInvoices,
  };
};

export const getPatientPortalOverview = functions.https.onCall(getPatientPortalOverviewHandler);
export const getPatientPortalOverviewHttp = makeHttpHandler(getPatientPortalOverviewHandler);
