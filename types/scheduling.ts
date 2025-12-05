export type WeekdayKey = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface ScheduleTimeRange {
  start: string; // HH:MM (24h)
  end: string;   // HH:MM (24h)
}

export interface ProviderSchedule {
  providerId: string;
  timezone?: string | null;
  slotDurationMinutes?: number | null;
  weeklyAvailability: Record<WeekdayKey, ScheduleTimeRange[]>;
  overrides: Record<string, ScheduleTimeRange[]>;
  blockedDates: string[];
}

export interface ProviderScheduleResponse {
  providerId: string;
  schedule: ProviderSchedule | null;
}
