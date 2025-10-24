import { mockAppointments, mockInvoices, mockPatients } from './mockData';
import { type Appointment, AppointmentType, Patient, User } from '../types';
import { createInvoiceForAppointment } from './billing';

export const fetchAppointmentsForToday = async (): Promise<Appointment[]> => {
  console.log("Fetching today's appointments...");
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  
  // In a real app, you would filter by date on the backend.
  // Here we just return all mock appointments for demonstration.
  console.log("Appointments fetched:", mockAppointments);
  return mockAppointments;
};

export const fetchAppointmentsForPatient = async (patientId: string): Promise<Appointment[]> => {
    console.log(`Fetching appointments for patient ${patientId}...`);
    await new Promise(resolve => setTimeout(resolve, 600));
    const appointments = mockAppointments.filter(a => a.patient.id === patientId);
    console.log(`Found ${appointments.length} appointments for patient ${patientId}`);
    return appointments;
}

export const getAppointmentById = async (appointmentId: string): Promise<Appointment | undefined> => {
    console.log(`Fetching appointment ${appointmentId}...`);
    await new Promise(resolve => setTimeout(resolve, 300));
    const appointment = mockAppointments.find(a => a.id === appointmentId);
    console.log("Appointment fetched:", appointment);
    return appointment;
}

// In a real app, this would be a PATCH request
export const updateAppointmentStatus = async (appointmentId: string, status: Appointment['status']): Promise<Appointment | undefined> => {
    console.log(`Updating appointment ${appointmentId} to status ${status}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    const appointment = mockAppointments.find(a => a.id === appointmentId);
    if(appointment) {
        appointment.status = status;
        
        // If checking in, record the time
        if (status === 'checked_in') {
            appointment.checkinTime = new Date().toISOString();
        }

        // If consultation is finished, ensure an invoice exists
        if (status === 'attended_pending_payment' && !appointment.associatedInvoiceId) {
            console.log(`No invoice found for appointment ${appointmentId}. Creating one.`);
            const newInvoice = createInvoiceForAppointment(appointment);
            mockInvoices.push(newInvoice);
            appointment.associatedInvoiceId = newInvoice.id;
            console.log(`Created and associated invoice ${newInvoice.id}`);
        }

        return appointment;
    }
    return undefined;
}

export interface NewAppointmentData {
    patient: Patient;
    doctor: User;
    startTime: string;
    type: AppointmentType;
    notes?: string;
}

export const createAppointment = async (appointmentData: NewAppointmentData): Promise<Appointment> => {
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const startTime = new Date(appointmentData.startTime);
    const endTime = new Date(startTime.getTime() + appointmentData.type.durationMinutes * 60000);

    const newAppointment: Appointment = {
        ...appointmentData,
        id: `apt-${mockAppointments.length + 1 + Math.random()}`,
        endTime: endTime.toISOString(),
        status: 'confirmed', // Default to confirmed for new appointments via modal
    };
    mockAppointments.push(newAppointment);
    console.log("Created new appointment:", newAppointment);
    return newAppointment;
}
