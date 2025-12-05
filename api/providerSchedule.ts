import { callBackendFunction } from './functionsClient';
import { type ProviderSchedule, type ProviderScheduleResponse, type ScheduleTimeRange, type WeekdayKey } from '../types';

const WEEKDAY_KEYS: WeekdayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const isValidTime = (value: string): boolean => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const normalizeRange = (raw: any): ScheduleTimeRange | null => {
  if (!raw) return null;
  const start = typeof raw.start === 'string' ? raw.start.trim() : '';
  const end = typeof raw.end === 'string' ? raw.end.trim() : '';
  if (!isValidTime(start) || !isValidTime(end)) {
    return null;
  }
  if (start >= end) {
    return null;
  }
  return { start, end };
};

const normalizeWeeklyAvailability = (raw: any): Record<WeekdayKey, ScheduleTimeRange[]> => {
  const weekly: Record<WeekdayKey, ScheduleTimeRange[]> = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };
  if (raw && typeof raw === 'object') {
    for (const key of WEEKDAY_KEYS) {
      const ranges = Array.isArray(raw[key]) ? raw[key] : [];
      weekly[key] = ranges
        .map(normalizeRange)
        .filter((range): range is ScheduleTimeRange => !!range);
    }
  }
  return weekly;
};

const normalizeOverrides = (raw: any): Record<string, ScheduleTimeRange[]> => {
  const overrides: Record<string, ScheduleTimeRange[]> = {};
  if (!raw || typeof raw !== 'object') {
    return overrides;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || !Array.isArray(value)) {
      continue;
    }
    const normalized = value
      .map(normalizeRange)
      .filter((range): range is ScheduleTimeRange => !!range);
    overrides[key] = normalized;
  }
  return overrides;
};

export const getProviderSchedule = async (providerId?: string): Promise<ProviderSchedule | null> => {
  const payload = providerId ? { providerId } : {};
  const result = await callBackendFunction<ProviderScheduleResponse>('getProviderSchedule', payload);
  if (!result || !result.schedule) {
    return null;
  }

  const schedule = result.schedule;
  return {
    providerId: schedule.providerId || result.providerId,
    timezone: schedule.timezone ?? null,
    slotDurationMinutes: typeof schedule.slotDurationMinutes === 'number' ? schedule.slotDurationMinutes : null,
    weeklyAvailability: normalizeWeeklyAvailability(schedule.weeklyAvailability),
    overrides: normalizeOverrides(schedule.overrides),
    blockedDates: Array.isArray(schedule.blockedDates) ? schedule.blockedDates.map(value => String(value)) : [],
  };
};

export interface SaveProviderScheduleInput {
  providerId?: string;
  timezone?: string;
  slotDurationMinutes?: number;
  weeklyAvailability: Partial<Record<WeekdayKey, ScheduleTimeRange[]>>;
  overrides?: Record<string, ScheduleTimeRange[]>;
  blockedDates?: string[];
}

const serializeWeeklyAvailability = (weekly: Partial<Record<WeekdayKey, ScheduleTimeRange[]>>): Record<WeekdayKey, ScheduleTimeRange[]> => {
  const normalized = normalizeWeeklyAvailability(weekly);
  const serialized: Record<WeekdayKey, ScheduleTimeRange[]> = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };
  for (const key of WEEKDAY_KEYS) {
    serialized[key] = (normalized[key] || []).map(range => ({ start: range.start, end: range.end }));
  }
  return serialized;
};

const serializeOverrides = (overrides: Record<string, ScheduleTimeRange[]> | undefined): Record<string, ScheduleTimeRange[]> => {
  if (!overrides) return {};
  const normalized = normalizeOverrides(overrides);
  const serialized: Record<string, ScheduleTimeRange[]> = {};
  for (const [key, ranges] of Object.entries(normalized)) {
    serialized[key] = ranges.map(range => ({ start: range.start, end: range.end }));
  }
  return serialized;
};

export const saveProviderSchedule = async (input: SaveProviderScheduleInput): Promise<void> => {
  const payload = {
    providerId: input.providerId,
    timezone: input.timezone?.trim(),
    slotDurationMinutes: input.slotDurationMinutes,
    weeklyAvailability: serializeWeeklyAvailability(input.weeklyAvailability || {}),
    overrides: serializeOverrides(input.overrides),
    blockedDates: Array.isArray(input.blockedDates) ? input.blockedDates.map(value => String(value)) : [],
  };

  await callBackendFunction('saveProviderSchedule', payload);
};
