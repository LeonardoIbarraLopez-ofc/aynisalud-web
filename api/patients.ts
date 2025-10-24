import { mockPatients } from './mockData';
import { type Patient, type QuickPatientInput } from '../types';

export const searchPatients = async (query: string): Promise<Patient[]> => {
    await new Promise(resolve => setTimeout(resolve, 400));
    if (!query) return [];
    const lowerCaseQuery = query.toLowerCase();
    return mockPatients.filter(p => 
        p.firstName.toLowerCase().includes(lowerCaseQuery) ||
        p.lastName.toLowerCase().includes(lowerCaseQuery) ||
        p.idNumber.includes(lowerCaseQuery) ||
        p.contactInfo.phone.includes(lowerCaseQuery)
    );
};

export const createQuickPatient = async (patientData: QuickPatientInput): Promise<Patient> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newPatientId = `patient-${mockPatients.length + 1}-${Math.random()}`;
    const newPatient: Patient = {
        id: newPatientId,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        dob: '', // To be filled later
        gender: 'other', // To be filled later
        idNumber: '', // To be filled later
        contactInfo: {
            phone: patientData.phone,
            email: '',
            address: ''
        },
        insuranceInfo: [],
        allergies: [],
        chronicConditions: [],
        avatarUrl: `https://i.pravatar.cc/150?u=${newPatientId}`
    };
    mockPatients.push(newPatient);
    return newPatient;
}