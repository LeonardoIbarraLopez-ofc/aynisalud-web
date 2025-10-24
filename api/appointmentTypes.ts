import { mockAppointmentTypes } from './mockData';
import { type AppointmentType } from '../types';

export const getAppointmentTypes = async (): Promise<AppointmentType[]> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return mockAppointmentTypes;
}