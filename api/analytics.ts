import { callBackendFunction } from './functionsClient';
import { type AppointmentAnalyticsPayload } from '../types';

export interface AppointmentAnalyticsFilters {
    startDate?: string;
    endDate?: string;
    clinicId?: string;
}

export const fetchAppointmentAnalytics = async (
    filters: AppointmentAnalyticsFilters = {},
): Promise<AppointmentAnalyticsPayload> => {
    const payload: Record<string, unknown> = {};
    if (filters.startDate) payload.startDate = filters.startDate;
    if (filters.endDate) payload.endDate = filters.endDate;
    if (filters.clinicId) payload.clinicId = filters.clinicId;

    const result = await callBackendFunction<AppointmentAnalyticsPayload>('getAppointmentAnalytics', payload);

    return {
        ...result,
        dailySeries: Array.isArray(result.dailySeries)
            ? [...result.dailySeries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            : [],
        typeDistribution: Array.isArray(result.typeDistribution) ? result.typeDistribution : [],
        statusDistribution: Array.isArray(result.statusDistribution) ? result.statusDistribution : [],
        topProviders: Array.isArray(result.topProviders) ? result.topProviders : [],
    };
};
