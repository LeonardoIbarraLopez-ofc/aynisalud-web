import { callBackendFunction } from './functionsClient';
import { normalizePatient } from './patients';
import { normalizeAppointment } from './appointments';
import { normalizeInvoice } from './billing';
import { type Appointment, type Invoice, type Patient, type PatientPortalOverview } from '../types';

const mapAppointments = (raw: any[]): Appointment[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeAppointment);
};

const mapInvoices = (raw: any[]): Invoice[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeInvoice);
};

const mapPatient = (raw: any): Patient => normalizePatient(raw || {});

export const getPatientPortalOverview = async (): Promise<PatientPortalOverview> => {
  const result = await callBackendFunction<{
    patient?: any;
    upcomingAppointments?: any[];
    pendingInvoices?: any[];
    recentInvoices?: any[];
  }>('getPatientPortalOverview', {});

  if (!result || !result.patient) {
    throw new Error('No se pudo cargar la información del paciente.');
  }

  const patient = mapPatient(result.patient);
  const upcomingAppointments = mapAppointments(result.upcomingAppointments || []);
  const pendingInvoices = mapInvoices(result.pendingInvoices || []);
  const recentInvoices = mapInvoices(result.recentInvoices || []);

  return {
    patient,
    upcomingAppointments,
    pendingInvoices,
    recentInvoices,
  };
};
