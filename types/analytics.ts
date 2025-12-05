export interface AppointmentAnalyticsRange {
  startDate: string;
  endDate: string;
  days: number;
}

export interface AppointmentAnalyticsSummary {
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface AppointmentDailyPoint {
  date: string;
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface AppointmentTypeDistributionItem {
  typeId: string;
  typeName: string;
  count: number;
}

export interface AppointmentStatusDistributionItem {
  status: string;
  count: number;
}

export interface ProviderPerformanceItem {
  doctorId: string;
  doctorName: string;
  count: number;
}

export interface AppointmentAnalyticsPayload {
  range: AppointmentAnalyticsRange;
  summary: AppointmentAnalyticsSummary;
  dailySeries: AppointmentDailyPoint[];
  typeDistribution: AppointmentTypeDistributionItem[];
  statusDistribution: AppointmentStatusDistributionItem[];
  topProviders: ProviderPerformanceItem[];
}
