import { type User, type Patient, type Appointment, type AppointmentType, type Invoice, type EHR } from '../types';

export const mockUsers: User[] = [
  { id: 'user-1', name: 'Marisol', email: 'marisol@aynialud.com', role: 'receptionist', isActive: true, avatarUrl: 'https://picsum.photos/id/1005/100/100' },
  { id: 'user-2', name: 'Dr. Mendoza', email: 'mendoza@aynisalud.com', role: 'doctor', isActive: true, avatarUrl: 'https://picsum.photos/id/1006/100/100' },
  { id: 'user-3', name: 'Dra. Rojas', email: 'rojas@aynisalud.com', role: 'specialist', isActive: true, avatarUrl: 'https://picsum.photos/id/1027/100/100' },
  { id: 'user-4', name: 'Gerente de la Clínica', email: 'admin@aynisalud.com', role: 'admin', isActive: true, avatarUrl: 'https://picsum.photos/id/10/100/100' },
  { id: 'user-5', name: 'Carlos Pérez', email: 'carlos.perez@email.com', role: 'patient', isActive: true, avatarUrl: 'https://i.pravatar.cc/150?u=patient-1' },
];

export const mockPatients: Patient[] = [
  {
    id: 'patient-1',
    firstName: 'Carlos',
    lastName: 'Pérez',
    dob: '1989-05-15',
    gender: 'male',
    idNumber: '12345678',
    contactInfo: { email: 'carlos.perez@email.com', phone: '555-0101', address: '123 Main St' },
    insuranceInfo: [{ providerName: 'SeguroSol', policyNumber: 'SN12345', coverageDetails: 'Full' }],
    allergies: ['Penicillin'],
    chronicConditions: ['Pre-diabetes'],
    avatarUrl: 'https://i.pravatar.cc/150?u=patient-1',
  },
  {
    id: 'patient-2',
    firstName: 'Elena',
    lastName: 'Gonzales',
    dob: '1955-08-20',
    gender: 'female',
    idNumber: '87654321',
    contactInfo: { email: 'elena.gonzales@email.com', phone: '555-0102', address: '456 Oak Ave' },
    insuranceInfo: [{ providerName: 'VidaSana', policyNumber: 'VS98765', coverageDetails: 'Basic' }],
    allergies: [],
    chronicConditions: ['Hypertension'],
    avatarUrl: 'https://i.pravatar.cc/150?u=patient-2',
  },
  {
    id: 'patient-3',
    firstName: 'Juan',
    lastName: 'Martinez',
    dob: '2001-01-30',
    gender: 'male',
    idNumber: '11223344',
    contactInfo: { email: 'juan.martinez@email.com', phone: '555-0103', address: '789 Pine Ln' },
    insuranceInfo: [],
    allergies: ['Peanuts'],
    chronicConditions: ['Asthma'],
    avatarUrl: 'https://i.pravatar.cc/150?u=patient-3',
  },
    {
    id: 'patient-4',
    firstName: 'Lucía',
    lastName: 'Fernández',
    dob: '1995-11-10',
    gender: 'female',
    idNumber: '44556677',
    contactInfo: { email: 'lucia.f@email.com', phone: '555-0104', address: '321 Maple Rd' },
    insuranceInfo: [{ providerName: 'SeguroSol', policyNumber: 'SN67890', coverageDetails: 'Full' }],
    allergies: [],
    chronicConditions: [],
    avatarUrl: 'https://i.pravatar.cc/150?u=patient-4',
  },
  {
    id: 'patient-5',
    firstName: 'Miguel',
    lastName: 'Rodríguez',
    dob: '1978-03-25',
    gender: 'male',
    idNumber: '99887766',
    contactInfo: { email: 'miguel.r@email.com', phone: '555-0105', address: '654 Elm St' },
    insuranceInfo: [],
    allergies: ['Aspirin'],
    chronicConditions: ['High Cholesterol'],
    avatarUrl: 'https://i.pravatar.cc/150?u=patient-5',
  },
];

export const mockAppointmentTypes: AppointmentType[] = [
    { id: 'type-1', name: 'Consulta General', durationMinutes: 30, price: 150, description: 'Chequeo de rutina.'},
    { id: 'type-2', name: 'Consulta de Seguimiento', durationMinutes: 20, price: 100, description: 'Revisión de tratamiento.'},
    { id: 'type-3', name: 'Cardiología', durationMinutes: 45, price: 300, description: 'Consulta con especialista.'},
];

export const mockInvoices: Invoice[] = [
    {
        id: 'inv-1',
        patientId: 'patient-2',
        date: new Date(new Date().setHours(8, 45)).toISOString(),
        dueDate: new Date().toISOString(),
        status: 'draft', // This one is pending payment
        items: [{ description: 'Consulta de Seguimiento', quantity: 1, unitPrice: 100, total: 100 }],
        subtotal: 100, tax: 0, total: 100,
    },
    {
        id: 'inv-2',
        patientId: 'patient-1',
        date: new Date(new Date().setHours(11, 50)).toISOString(),
        dueDate: new Date().toISOString(),
        status: 'paid',
        items: [{ description: 'Cardiología', quantity: 1, unitPrice: 300, total: 300 }],
        subtotal: 300, tax: 0, total: 300,
        paymentDetails: [{ method: 'Tarjeta', amount: 300, transactionDate: new Date(new Date().setHours(11, 55)).toISOString() }]
    },
    {
        id: 'inv-3',
        patientId: 'patient-0-for-another-paid-one', //
        date: new Date(new Date().setHours(10, 15)).toISOString(),
        dueDate: new Date().toISOString(),
        status: 'paid',
        items: [{ description: 'Consulta General', quantity: 1, unitPrice: 150, total: 150 }],
        subtotal: 150, tax: 0, total: 150,
        paymentDetails: [{ method: 'Efectivo', amount: 150, transactionDate: new Date(new Date().setHours(10, 20)).toISOString() }]
    },
     {
        id: 'inv-4',
        patientId: 'patient-X',
        date: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: 'paid',
        items: [{ description: 'Procedimiento Menor', quantity: 1, unitPrice: 800, total: 800 }],
        subtotal: 800, tax: 0, total: 800,
        paymentDetails: [{ method: 'Tarjeta', amount: 300, transactionDate: new Date().toISOString() }, { method: 'QR', amount: 500, transactionDate: new Date().toISOString() }]
    }
];

// Set check-in time for patient Elena Gonzales to 7 minutes ago
const checkinTimeElena = new Date();
checkinTimeElena.setMinutes(checkinTimeElena.getMinutes() - 7);

// Function to get a date in the future
const getFutureDate = (days: number, hours: number, minutes: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hours, minutes, 0, 0);
    return date;
}

export const mockAppointments: Appointment[] = [
  {
    id: 'apt-8',
    patient: mockPatients[1],
    doctor: mockUsers[1],
    startTime: new Date(new Date().setHours(8, 30, 0, 0)).toISOString(),
    endTime: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    status: 'attended_pending_payment',
    type: mockAppointmentTypes[1],
    associatedInvoiceId: 'inv-1',
    notes: "Paciente listo para check-out."
  },
  {
    id: 'apt-1',
    patient: mockPatients[0],
    doctor: mockUsers[1],
    startTime: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    endTime: new Date(new Date().setHours(9, 30, 0, 0)).toISOString(),
    status: 'confirmed',
    type: mockAppointmentTypes[0],
    notes: 'Control anual.',
  },
  {
    id: 'apt-2',
    patient: mockPatients[1],
    doctor: mockUsers[1],
    startTime: new Date(new Date().setHours(9, 30, 0, 0)).toISOString(),
    endTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    status: 'checked_in',
    type: mockAppointmentTypes[1],
    checkinTime: checkinTimeElena.toISOString(),
    notes: 'Seguimiento Hipertensión',
  },
   {
    id: 'apt-3',
    patient: mockPatients[2],
    doctor: mockUsers[1],
    startTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    endTime: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(),
    status: 'pending_confirmation',
    type: mockAppointmentTypes[0],
    notes: 'Consulta por asma',
  },
  {
    id: 'apt-5',
    patient: mockPatients[0],
    doctor: mockUsers[1],
    startTime: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(),
    endTime: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
    status: 'in_progress',
    type: mockAppointmentTypes[1],
    checkinTime: new Date(new Date().setHours(10, 25, 0, 0)).toISOString(),
    notes: 'Revisión de resultados de laboratorio',
  },
  {
    id: 'apt-4',
    patient: mockPatients[0],
    doctor: mockUsers[2],
    startTime: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
    endTime: new Date(new Date().setHours(11, 45, 0, 0)).toISOString(),
    status: 'completed',
    type: mockAppointmentTypes[2],
    notes: 'Referido por Dr. Mendoza. Pago realizado.',
    associatedInvoiceId: 'inv-2'
  },
  {
    id: 'apt-6',
    patient: mockPatients[1],
    doctor: mockUsers[2],
    startTime: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    endTime: new Date(new Date().setHours(14, 45, 0, 0)).toISOString(),
    status: 'pending_confirmation',
    type: mockAppointmentTypes[2],
  },
  { // Future appointment for patient portal
    id: 'apt-future-1',
    patient: mockPatients[0], // Carlos Pérez
    doctor: mockUsers[1],
    startTime: getFutureDate(3, 10, 0).toISOString(),
    endTime: getFutureDate(3, 10, 30).toISOString(),
    status: 'confirmed',
    type: mockAppointmentTypes[0],
    notes: 'Seguimiento de pre-diabetes'
  }
];

// Mock Electronic Health Records
export const mockEHRs: EHR[] = [
    {
        patientId: 'patient-1', // Carlos Pérez
        snapshot: [
            { type: 'diagnosis', title: 'Pre-diabetes', details: 'Diagnosticado hace 6 meses. Monitoreo de glucosa.' },
            { type: 'allergy', title: 'Penicilina', details: 'Reacción: Urticaria.', isCritical: true },
            { type: 'medication', title: 'Metformina', details: '500mg una vez al día.' },
            { type: 'vital', title: 'Última Presión Arterial', details: '130/85 mmHg', date: '2023-10-15' },
            { type: 'note', title: 'Nota Adhesiva', details: 'Discutir resultados de mamografía en la próxima visita.'}
        ],
        timeline: [
            { id: 'ev-1-1', type: 'ConsultationNote', date: '2023-10-15', title: 'Control Anual', summary: 'Paciente estable, se ajusta dosis de Metformina.', actor: 'Dr. Mendoza' },
            { id: 'ev-1-2', type: 'LabResult', date: '2023-10-10', title: 'Perfil Lipídico', summary: 'Colesterol total ligeramente elevado.', actor: 'Laboratorio Central' },
            { id: 'ev-1-3', type: 'Prescription', date: '2023-04-12', title: 'Metformina 500mg', summary: '1 tableta al día.', actor: 'Dr. Mendoza' },
        ],
    },
    {
        patientId: 'patient-2', // Elena Gonzales
        snapshot: [
            { type: 'diagnosis', title: 'Hipertensión Arterial', details: 'En tratamiento desde hace 5 años.' },
            { type: 'medication', title: 'Losartán', details: '50mg una vez al día.' },
            { type: 'medication', title: 'Hidroclorotiazida', details: '12.5mg una vez al día.' },
            { type: 'vital', title: 'Última Presión Arterial', details: '140/90 mmHg', date: '2023-11-01' },
            { type: 'note', title: 'Nota Adhesiva', details: 'Paciente con fobia a las agujas.'}
        ],
        timeline: [
            { id: 'ev-2-1', type: 'ConsultationNote', date: '2023-11-01', title: 'Seguimiento Hipertensión', summary: 'Presión arterial no controlada, se considera ajuste de tratamiento.', actor: 'Dr. Mendoza' },
            { id: 'ev-2-2', type: 'ImageStudy', date: '2023-05-20', title: 'Radiografía de Tórax', summary: 'Sin hallazgos patológicos.', actor: 'Radiología Ayni' },
            { id: 'ev-2-3', type: 'Prescription', date: '2022-01-10', title: 'Losartán 50mg', summary: '1 tableta al día.', actor: 'Dr. Mendoza' },
        ],
    },
    {
        patientId: 'patient-3', // Juan Martinez
        snapshot: [
            { type: 'diagnosis', title: 'Asma', details: 'Diagnosticado en la infancia.' },
            { type: 'allergy', title: 'Maní', details: 'Reacción: Anafilaxia.', isCritical: true },
            { type: 'medication', title: 'Salbutamol (Inhalador)', details: 'Según necesidad.' },
        ],
        timeline: [
            { id: 'ev-3-1', type: 'ConsultationNote', date: '2023-09-05', title: 'Consulta por crisis asmática', summary: 'Se indica tratamiento con corticoides por 5 días.', actor: 'Dr. Mendoza' },
        ],
    }
];