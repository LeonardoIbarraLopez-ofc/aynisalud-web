import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { requireAuth, db, sanitizeForFirestore, getServerTimestamp, toIsoString } from './utils';
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

interface AppointmentTypeDoc {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description?: string;
}

interface DoctorDoc {
  id: string;
  name: string;
  email?: string;
  role?: string;
  phone?: string;
  isActive?: boolean;
  clinicId?: string;
  professionalLicense?: string;
  specialties?: string[];
  languages?: string[];
  yearsExperience?: number;
  bio?: string;
}

type WeekdayKey = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

interface ScheduleTimeRange {
  start: string; // HH:MM (24h)
  end: string;   // HH:MM (24h)
}

interface ProviderSchedule {
  providerId: string;
  timezone?: string;
  slotDurationMinutes?: number;
  weeklyAvailability: Record<WeekdayKey, ScheduleTimeRange[]>;
  overrides: Record<string, ScheduleTimeRange[]>; // keyed by YYYY-MM-DD
  blockedDates: string[];
}

interface ScheduleWindow {
  start: Date;
  end: Date;
}

interface PatientDoc {
  id: string;
  firstName: string;
  lastName: string;
  contactInfo: {
    email: string;
    phone: string;
    address: string;
  };
  insuranceInfo: any[];
  allergies: string[];
  chronicConditions: string[];
  avatarUrl?: string;
  clinicId?: string | null;
}

interface AvailabilitySlot {
  startTime: string;
  endTime: string;
}

interface DoctorAvailability {
  doctorId: string;
  doctorName: string;
  clinicId?: string | null;
  slots: AvailabilitySlot[];
  professionalLicense?: string;
  specialties?: string[];
  languages?: string[];
  yearsExperience?: number;
  bio?: string;
  timezone?: string;
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
  clinicId?: string | null;
  isActive?: boolean;
  professionalLicense?: string;
  specialties?: string[];
  languages?: string[];
  yearsExperience?: number;
  bio?: string;
}

const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;
const OCCUPIED_STATUSES: AppointmentStatus[] = [
  'pending_confirmation',
  'confirmed',
  'checked_in',
  'in_progress',
  'attended_pending_payment',
  'completed',
];

const WEEKDAY_KEYS: WeekdayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function normalizeTimeRange(raw: any): ScheduleTimeRange | null {
  if (!raw) return null;
  const start = typeof raw.start === 'string' ? raw.start.trim() : '';
  const end = typeof raw.end === 'string' ? raw.end.trim() : '';
  const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!pattern.test(start) || !pattern.test(end)) {
    return null;
  }
  if (start >= end) {
    return null;
  }
  return { start, end };
}

function isValidDateKey(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }
  const parsed = new Date(`${trimmed}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

async function loadProviderProfile(providerId: string, role?: string): Promise<Partial<DoctorDoc>> {
  const collection = role === 'specialist' ? 'specialistProfiles' : 'doctorProfiles';
  const docSnap = await db.doc(`${collection}/${providerId}`).get();
  if (!docSnap.exists) {
    return {};
  }
  const data = docSnap.data() as any;
  const result: Partial<DoctorDoc> = {};
  if (data?.professionalLicense) {
    result.professionalLicense = String(data.professionalLicense);
  }
  if (Array.isArray(data?.specialties)) {
    result.specialties = data.specialties.map((item: any) => String(item)).filter(Boolean);
  }
  if (Array.isArray(data?.languages)) {
    result.languages = data.languages.map((item: any) => String(item)).filter(Boolean);
  }
  if (Number.isFinite(data?.yearsExperience)) {
    result.yearsExperience = Number(data.yearsExperience);
  }
  if (data?.bio) {
    result.bio = String(data.bio);
  }
  return result;
}

async function loadProviderSchedule(providerId: string): Promise<ProviderSchedule | null> {
  const docSnap = await db.doc(`providerSchedules/${providerId}`).get();
  if (!docSnap.exists) {
    return null;
  }
  const data = docSnap.data() as any;
  const weeklyRaw = data?.weeklyAvailability && typeof data.weeklyAvailability === 'object' ? data.weeklyAvailability : {};
  const weeklyAvailability: Record<WeekdayKey, ScheduleTimeRange[]> = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };

  for (const key of WEEKDAY_KEYS) {
    const rangesRaw = Array.isArray(weeklyRaw?.[key]) ? weeklyRaw[key] : [];
    weeklyAvailability[key] = rangesRaw
      .map(normalizeTimeRange)
      .filter((range): range is ScheduleTimeRange => !!range);
  }

  const overrides: Record<string, ScheduleTimeRange[]> = {};
  if (data?.overrides && typeof data.overrides === 'object') {
    for (const [dateKey, value] of Object.entries(data.overrides as Record<string, any>)) {
      if (!isValidDateKey(dateKey) || !Array.isArray(value)) {
        continue;
      }
      const normalized = (value as any[])
        .map(item => normalizeTimeRange(item))
        .filter((range): range is ScheduleTimeRange => !!range);
      overrides[dateKey] = normalized;
    }
  }

  let blockedDates: string[] = [];
  if (Array.isArray(data?.blockedDates)) {
    const filtered = data.blockedDates
      .map((item: any) => String(item).trim())
      .filter(isValidDateKey);
    const unique = new Set<string>(filtered);
    blockedDates = Array.from(unique);
  }

  return {
    providerId: docSnap.id,
    timezone: data?.timezone ? String(data.timezone) : undefined,
    slotDurationMinutes: Number.isFinite(data?.slotDurationMinutes) ? Number(data.slotDurationMinutes) : undefined,
    weeklyAvailability,
    overrides,
    blockedDates,
  };
}

function applyTimeToDate(base: Date, time: string): Date | null {
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const result = new Date(base);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function resolveScheduleWindows(schedule: ProviderSchedule | null, targetDate: Date): ScheduleWindow[] {
  if (!schedule) {
    const { start, end } = buildWorkdayWindow(targetDate);
    return [{ start, end }];
  }

  const baseDate = new Date(targetDate);
  baseDate.setHours(0, 0, 0, 0);
  const dateKey = baseDate.toISOString().split('T')[0];

  if (schedule.blockedDates.includes(dateKey)) {
    return [];
  }

  const overrideRanges = schedule.overrides[dateKey];
  const weekdayIndex = baseDate.getUTCDay();
  const weekdayKey = WEEKDAY_KEYS[weekdayIndex];
  const rangesSource = Array.isArray(overrideRanges) ? overrideRanges : schedule.weeklyAvailability[weekdayKey] || [];

  const windows: ScheduleWindow[] = [];
  for (const range of rangesSource) {
    const start = applyTimeToDate(baseDate, range.start);
    const end = applyTimeToDate(baseDate, range.end);
    if (!start || !end || end.getTime() <= start.getTime()) {
      continue;
    }
    windows.push({ start, end });
  }

  if (windows.length === 0 && !overrideRanges) {
    // Fallback to default business hours when no schedule is defined for the day.
    const { start, end } = buildWorkdayWindow(baseDate);
    return [{ start, end }];
  }

  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function getSlotDurationMinutes(schedule: ProviderSchedule | null, appointmentDuration: number): number {
  if (!schedule || !Number.isFinite(schedule.slotDurationMinutes || NaN)) {
    return appointmentDuration;
  }
  const slotLength = Number(schedule.slotDurationMinutes);
  if (slotLength <= 0) {
    return appointmentDuration;
  }
  return Math.max(slotLength, appointmentDuration);
}

function ensureProviderManagementAccess(role: UserRole | undefined) {
  const allowed: UserRole[] = ['doctor', 'specialist', 'admin', 'receptionist'];
  if (!role || !allowed.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'No autorizado para gestionar horarios.');
  }
}

function ensurePatientAccess(role: UserRole | undefined) {
  if (!role) {
    throw new functions.https.HttpsError('permission-denied', 'Autenticación requerida.');
  }
  const allowed: UserRole[] = ['patient', 'admin', 'receptionist'];
  if (!allowed.includes(role)) {
    throw new functions.https.HttpsError('permission-denied', 'No autorizado para solicitar citas.');
  }
}

async function resolvePatientProfile(uid: string): Promise<PatientDoc> {
  const patientSnap = await db.collection('patients').where('authUid', '==', uid).limit(1).get();
  if (patientSnap.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'Debe completar su perfil de paciente antes de solicitar una cita.');
  }
  const doc = patientSnap.docs[0];
  const data = doc.data() as any;
  return {
    id: doc.id,
    firstName: String(data?.firstName || ''),
    lastName: String(data?.lastName || ''),
    contactInfo: {
      email: String(data?.contactInfo?.email || ''),
      phone: String(data?.contactInfo?.phone || ''),
      address: String(data?.contactInfo?.address || ''),
    },
    insuranceInfo: Array.isArray(data?.insuranceInfo) ? data.insuranceInfo : [],
    allergies: Array.isArray(data?.allergies) ? data.allergies : [],
    chronicConditions: Array.isArray(data?.chronicConditions) ? data.chronicConditions : [],
    avatarUrl: data?.avatarUrl || undefined,
    clinicId: data?.clinicId || null,
  };
}

async function resolveAppointmentType(typeId: string): Promise<AppointmentTypeDoc> {
  const snap = await db.doc(`appointmentTypes/${typeId}`).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('invalid-argument', 'Tipo de cita inválido.');
  }
  const data = snap.data() as any;
  return {
    id: snap.id,
    name: String(data?.name || ''),
    durationMinutes: Number.isFinite(data?.durationMinutes) ? Number(data.durationMinutes) : 30,
    price: Number.isFinite(data?.price) ? Number(data.price) : 0,
    description: data?.description || '',
  };
}

async function hydrateDoctorSnapshot(docSnap: FirebaseFirestore.DocumentSnapshot): Promise<DoctorDoc> {
  const data = docSnap.data() as any;
  const profile = await loadProviderProfile(docSnap.id, data?.role);
  const specialties = Array.isArray(profile.specialties) ? profile.specialties : [];
  const languages = Array.isArray(profile.languages) ? profile.languages : [];

  return {
    id: docSnap.id,
    name: String(data?.name || ''),
    email: data?.email || undefined,
    role: data?.role || undefined,
    phone: data?.phone || undefined,
    isActive: data?.isActive !== false,
    clinicId: data?.clinicId || null,
    professionalLicense: profile.professionalLicense,
    specialties,
    languages,
    yearsExperience: profile.yearsExperience,
    bio: profile.bio,
  };
}

async function listDoctorsForScheduling(doctorId?: string): Promise<DoctorDoc[]> {
  if (doctorId && doctorId !== 'any') {
    const snap = await db.doc(`users/${doctorId}`).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('invalid-argument', 'Doctor inválido.');
    }
    const data = snap.data() as any;
    if (data?.role !== 'doctor' && data?.role !== 'specialist') {
      throw new functions.https.HttpsError('invalid-argument', 'El profesional seleccionado no es un doctor.');
    }
    const doctor = await hydrateDoctorSnapshot(snap);
    return [doctor];
  }

  const snap = await db
    .collection('users')
    .where('role', 'in', ['doctor', 'specialist'])
    .limit(50)
    .get();

  const doctors = await Promise.all(snap.docs.map(hydrateDoctorSnapshot));
  return doctors.filter(doc => doc.isActive !== false);
}

function buildWorkdayWindow(date: Date) {
  const start = new Date(date);
  start.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
  const end = new Date(date);
  end.setHours(WORK_DAY_END_HOUR, 0, 0, 0);
  return { start, end };
}

function slotOverlaps(slotStart: Date, slotEnd: Date, appointment: FirebaseFirestore.DocumentData): boolean {
  const startIso = toIsoString(appointment?.startTime);
  const endIso = toIsoString(appointment?.endTime);
  if (!startIso || !endIso) return false;
  const start = new Date(startIso);
  const end = new Date(endIso);
  const status = appointment?.status as AppointmentStatus;
  if (!OCCUPIED_STATUSES.includes(status)) {
    return false;
  }
  return slotStart < end && slotEnd > start;
}

function buildDoctorSlots(
  appointments: FirebaseFirestore.QueryDocumentSnapshot[],
  durationMinutes: number,
  windows: ScheduleWindow[],
): AvailabilitySlot[] {
  if (windows.length === 0) {
    return [];
  }

  const slots: AvailabilitySlot[] = [];
  const durationMs = durationMinutes * 60000;
  const now = Date.now();

  for (const window of windows) {
    let cursor = new Date(window.start);
    while (cursor.getTime() + durationMs <= window.end.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + durationMs);

      const inPast = slotStart.getTime() < now;
      if (!inPast) {
        const overlaps = appointments.some(app => slotOverlaps(slotStart, slotEnd, app.data()));
        if (!overlaps) {
          slots.push({ startTime: slotStart.toISOString(), endTime: slotEnd.toISOString() });
        }
      }

      cursor = new Date(cursor.getTime() + durationMs);
    }
  }

  return slots;
}

const getPatientAvailabilityHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensurePatientAccess(token?.role as UserRole | undefined);

  const dateIso = String(data?.date || '').trim();
  const typeId = String(data?.appointmentTypeId || '').trim();
  const doctorId: string | undefined = data?.doctorId ? String(data.doctorId) : undefined;

  if (!dateIso) {
    throw new functions.https.HttpsError('invalid-argument', 'La fecha es obligatoria.');
  }
  if (!typeId) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe seleccionar un tipo de cita.');
  }

  const targetDate = new Date(dateIso);
  if (Number.isNaN(targetDate.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'Fecha inválida.');
  }

  const appointmentType = await resolveAppointmentType(typeId);
  const doctors = await listDoctorsForScheduling(doctorId);
  if (doctors.length === 0) {
    return { availability: [] as DoctorAvailability[] };
  }

  const startOfWindow = new Date(targetDate);
  startOfWindow.setHours(0, 0, 0, 0);
  const endOfWindow = new Date(targetDate);
  endOfWindow.setHours(23, 59, 59, 999);

  const availability: DoctorAvailability[] = [];

  for (const doctor of doctors) {
    const schedule = await loadProviderSchedule(doctor.id);
    const windows = resolveScheduleWindows(schedule, targetDate);
    const slotDurationMinutes = getSlotDurationMinutes(schedule, appointmentType.durationMinutes);

    const querySnap = await db
      .collection('appointments')
      .where('doctorId', '==', doctor.id)
      .where('startTime', '>=', startOfWindow)
      .where('startTime', '<=', endOfWindow)
      .get();

    const slots = buildDoctorSlots(querySnap.docs, slotDurationMinutes, windows);
    if (slots.length > 0) {
      availability.push({
        doctorId: doctor.id,
        doctorName: doctor.name,
        clinicId: doctor.clinicId || null,
        slots,
        professionalLicense: doctor.professionalLicense,
        specialties: doctor.specialties || [],
        languages: doctor.languages || [],
        yearsExperience: doctor.yearsExperience,
        bio: doctor.bio,
        timezone: schedule?.timezone,
      });
    } else if (!doctorId || doctorId === 'any') {
      availability.push({
        doctorId: doctor.id,
        doctorName: doctor.name,
        clinicId: doctor.clinicId || null,
        slots: [],
        professionalLicense: doctor.professionalLicense,
        specialties: doctor.specialties || [],
        languages: doctor.languages || [],
        yearsExperience: doctor.yearsExperience,
        bio: doctor.bio,
        timezone: schedule?.timezone,
      });
    }
  }

  return { availability };
};

const listPatientAppointmentTypesHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensurePatientAccess(token?.role as UserRole | undefined);

  const snap = await db.collection('appointmentTypes').limit(100).get();
  const appointmentTypes: AppointmentTypeSummary[] = snap.docs.map(doc => {
    const dataDoc = doc.data() as any;
    return {
      id: doc.id,
      name: String(dataDoc?.name || ''),
      durationMinutes: Number.isFinite(dataDoc?.durationMinutes) ? Number(dataDoc.durationMinutes) : 30,
      price: Number.isFinite(dataDoc?.price) ? Number(dataDoc.price) : 0,
      description: dataDoc?.description || '',
    };
  }).filter(type => type.name.trim().length > 0);

  appointmentTypes.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return { appointmentTypes };
};

const listPatientDoctorsHandler = async (data: any, context: any) => {
  const { token } = await requireAuth(context, data);
  ensurePatientAccess(token?.role as UserRole | undefined);

  const doctors = await listDoctorsForScheduling(data?.doctorId ? String(data.doctorId) : undefined);
  const normalized: DoctorSummary[] = doctors
    .filter(doc => doc.isActive !== false)
    .map(doc => ({
      id: doc.id,
      name: doc.name || 'Profesional disponible',
      email: doc.email,
      role: doc.role,
      phone: doc.phone,
      clinicId: doc.clinicId || null,
      isActive: doc.isActive !== false,
      professionalLicense: doc.professionalLicense,
      specialties: doc.specialties || [],
      languages: doc.languages || [],
      yearsExperience: doc.yearsExperience,
      bio: doc.bio,
    }));

  normalized.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return { doctors: normalized };
};

const requestAppointmentHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  ensurePatientAccess(token?.role as UserRole | undefined);

  const appointmentTypeId: string = String(data?.appointmentTypeId || '').trim();
  const doctorIdRaw: string = String(data?.doctorId || '').trim();
  const startTimeIso: string = String(data?.startTime || '').trim();
  const reason: string | undefined = data?.reason ? String(data.reason).trim() : undefined;
  const modality: string | undefined = data?.modality ? String(data.modality).trim() : undefined;
  const notes: string | undefined = data?.notes ? String(data.notes).trim() : undefined;
  const contactPhone: string | undefined = data?.contactPhone ? String(data.contactPhone).trim() : undefined;
  const contactEmail: string | undefined = data?.contactEmail ? String(data.contactEmail).trim() : undefined;

  if (!appointmentTypeId) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe seleccionar una especialidad.');
  }
  if (!startTimeIso) {
    throw new functions.https.HttpsError('invalid-argument', 'Debe seleccionar un horario disponible.');
  }

  const patientProfile = await resolvePatientProfile(uid as string);
  const appointmentType = await resolveAppointmentType(appointmentTypeId);

  let doctorCandidates = await listDoctorsForScheduling(doctorIdRaw || 'any');
  if (doctorCandidates.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'No hay doctores disponibles para este tipo de cita.');
  }

  let doctor: DoctorDoc | undefined = undefined;
  if (doctorIdRaw && doctorIdRaw !== 'any') {
    doctor = doctorCandidates.find(d => d.id === doctorIdRaw);
    if (!doctor) {
      throw new functions.https.HttpsError('invalid-argument', 'Doctor seleccionado inválido.');
    }
  }

  const requestedStart = new Date(startTimeIso);
  if (Number.isNaN(requestedStart.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'Horario seleccionado inválido.');
  }

  const now = new Date();
  if (requestedStart.getTime() < now.getTime()) {
    throw new functions.https.HttpsError('failed-precondition', 'Seleccione un horario futuro.');
  }

  const requestedEnd = new Date(requestedStart.getTime() + appointmentType.durationMinutes * 60000);

  const startOfDay = new Date(requestedStart);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestedStart);
  endOfDay.setHours(23, 59, 59, 999);

  if (!doctor) {
    for (const candidate of doctorCandidates) {
      const conflictSnap = await db
        .collection('appointments')
        .where('doctorId', '==', candidate.id)
        .where('startTime', '>=', startOfDay)
        .where('startTime', '<=', endOfDay)
        .get();
      const hasConflict = conflictSnap.docs.some(doc => slotOverlaps(requestedStart, requestedEnd, doc.data()));
      if (!hasConflict) {
        doctor = candidate;
        break;
      }
    }
    if (!doctor) {
      throw new functions.https.HttpsError('failed-precondition', 'No se encontró disponibilidad para el horario seleccionado.');
    }
  } else {
    const conflictSnap = await db
      .collection('appointments')
      .where('doctorId', '==', doctor.id)
      .where('startTime', '>=', startOfDay)
      .where('startTime', '<=', endOfDay)
      .get();
    const hasConflict = conflictSnap.docs.some(doc => slotOverlaps(requestedStart, requestedEnd, doc.data()));
    if (hasConflict) {
      throw new functions.https.HttpsError('already-exists', 'El horario seleccionado ya fue reservado.');
    }
  }

  if (!doctor) {
    throw new functions.https.HttpsError('failed-precondition', 'No se pudo asignar un doctor disponible.');
  }

  const doctorSnapshot = await db.doc(`users/${doctor.id}`).get();

  const doctorData = doctorSnapshot.data() || {};

  const payload = {
    patientId: patientProfile.id,
    doctorId: doctor.id,
    typeId: appointmentType.id,
    startTime: requestedStart,
    endTime: requestedEnd,
    status: 'pending_confirmation',
    notes: notes || null,
    clinicId: doctor.clinicId || patientProfile.clinicId || null,
    createdAt: getServerTimestamp(),
    updatedAt: getServerTimestamp(),
    createdBy: { uid, role: token?.role || 'patient', source: 'patient_portal' },
    patientSnapshot: sanitizeForFirestore({
      id: patientProfile.id,
      firstName: patientProfile.firstName,
      lastName: patientProfile.lastName,
      contactInfo: patientProfile.contactInfo,
      insuranceInfo: patientProfile.insuranceInfo,
      allergies: patientProfile.allergies,
      chronicConditions: patientProfile.chronicConditions,
      avatarUrl: patientProfile.avatarUrl || '',
      clinicId: patientProfile.clinicId || null,
    }),
    doctorSnapshot: sanitizeForFirestore({
      id: doctor.id,
      name: doctorData?.name || doctor.name,
      email: doctorData?.email || '',
      role: doctorData?.role || 'doctor',
      avatarUrl: doctorData?.avatarUrl || '',
      phone: doctorData?.phone || '',
      clinicId: doctorData?.clinicId || null,
    }),
    typeSnapshot: sanitizeForFirestore({
      id: appointmentType.id,
      name: appointmentType.name,
      durationMinutes: appointmentType.durationMinutes,
      price: appointmentType.price,
      description: appointmentType.description,
    }),
    requestDetails: sanitizeForFirestore({
      reason: reason || null,
      modality: modality || 'presencial',
      contactPhone: contactPhone || patientProfile.contactInfo.phone,
      contactEmail: contactEmail || patientProfile.contactInfo.email,
    }),
  };

  const docRef = db.collection('appointments').doc();
  await docRef.set(payload);

  await db.collection('appointmentRequests').doc(docRef.id).set({
    appointmentId: docRef.id,
    patientId: patientProfile.id,
    doctorId: doctor.id,
    typeId: appointmentType.id,
    status: 'pending_confirmation',
    createdAt: getServerTimestamp(),
    requestedStart: requestedStart,
    requestedEnd: requestedEnd,
    reason: reason || null,
  });

  return {
    appointmentId: docRef.id,
    doctorId: doctor.id,
    startTime: requestedStart.toISOString(),
    endTime: requestedEnd.toISOString(),
  };
};

const getProviderScheduleHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  const role = token?.role as UserRole | undefined;
  ensureProviderManagementAccess(role);

  let providerId = typeof data?.providerId === 'string' ? data.providerId.trim() : '';
  if (!providerId || role === 'doctor' || role === 'specialist') {
    providerId = providerId || uid;
  }

  if (!providerId) {
    throw new functions.https.HttpsError('invalid-argument', 'providerId requerido.');
  }

  if ((role === 'doctor' || role === 'specialist') && providerId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'No puede consultar los horarios de otros profesionales.');
  }

  const schedule = await loadProviderSchedule(providerId);

  if (!schedule) {
    return {
      providerId,
      schedule: null,
    };
  }

  return {
    providerId,
    schedule: {
      providerId: schedule.providerId,
      timezone: schedule.timezone || null,
      slotDurationMinutes: schedule.slotDurationMinutes || null,
      weeklyAvailability: schedule.weeklyAvailability,
      overrides: schedule.overrides,
      blockedDates: schedule.blockedDates,
    },
  };
};

const saveProviderScheduleHandler = async (data: any, context: any) => {
  const { uid, token } = await requireAuth(context, data);
  const role = token?.role as UserRole | undefined;
  ensureProviderManagementAccess(role);

  let providerId = typeof data?.providerId === 'string' ? data.providerId.trim() : '';
  if (!providerId || role === 'doctor' || role === 'specialist') {
    providerId = providerId || uid;
  }

  if (!providerId) {
    throw new functions.https.HttpsError('invalid-argument', 'providerId requerido.');
  }

  if ((role === 'doctor' || role === 'specialist') && providerId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'No puede actualizar los horarios de otros profesionales.');
  }

  const timezone = typeof data?.timezone === 'string' ? data.timezone.trim() : undefined;
  const durationRaw = Number(data?.slotDurationMinutes);
  const slotDurationMinutes = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw) : undefined;

  const weeklyInput = data?.weeklyAvailability && typeof data.weeklyAvailability === 'object' ? data.weeklyAvailability : {};
  const overridesInput = data?.overrides && typeof data.overrides === 'object' ? data.overrides : {};
  const blockedInput = Array.isArray(data?.blockedDates) ? data.blockedDates : [];

  const weeklyAvailability: Record<WeekdayKey, ScheduleTimeRange[]> = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };

  for (const key of WEEKDAY_KEYS) {
    const rangesRaw = Array.isArray((weeklyInput as any)[key]) ? (weeklyInput as any)[key] : [];
    weeklyAvailability[key] = (rangesRaw as any[])
      .map(item => normalizeTimeRange(item))
      .filter((range): range is ScheduleTimeRange => !!range);
  }

  const overrides: Record<string, ScheduleTimeRange[]> = {};
  for (const [dateKey, value] of Object.entries(overridesInput as Record<string, any>)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(value)) {
      continue;
    }
    const normalized = (value as any[])
      .map(item => normalizeTimeRange(item))
      .filter((range): range is ScheduleTimeRange => !!range);
    overrides[dateKey] = normalized;
  }

  const blockedDates = Array.from(
    new Set(
      blockedInput
        .map((item: any) => String(item).trim())
        .filter(isValidDateKey),
    ),
  );

  const payload = sanitizeForFirestore({
    providerId,
    timezone: timezone || null,
    slotDurationMinutes: slotDurationMinutes || null,
    weeklyAvailability,
    overrides,
    blockedDates,
    updatedAt: getServerTimestamp(),
    updatedBy: {
      uid,
      role: role || 'unknown',
    },
  });

  await db.doc(`providerSchedules/${providerId}`).set(payload, { merge: true });

  return {
    providerId,
    saved: true,
  };
};

export const getPatientAvailability = functions.https.onCall(getPatientAvailabilityHandler);
export const getPatientAvailabilityHttp = makeHttpHandler(getPatientAvailabilityHandler);
export const requestAppointment = functions.https.onCall(requestAppointmentHandler);
export const requestAppointmentHttp = makeHttpHandler(requestAppointmentHandler);
export const listPatientAppointmentTypes = functions.https.onCall(listPatientAppointmentTypesHandler);
export const listPatientAppointmentTypesHttp = makeHttpHandler(listPatientAppointmentTypesHandler);
export const listPatientDoctors = functions.https.onCall(listPatientDoctorsHandler);
export const listPatientDoctorsHttp = makeHttpHandler(listPatientDoctorsHandler);
export const getProviderSchedule = functions.https.onCall(getProviderScheduleHandler);
export const getProviderScheduleHttp = makeHttpHandler(getProviderScheduleHandler);
export const saveProviderSchedule = functions.https.onCall(saveProviderScheduleHandler);
export const saveProviderScheduleHttp = makeHttpHandler(saveProviderScheduleHandler);
