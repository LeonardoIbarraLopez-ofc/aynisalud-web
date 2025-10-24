export interface ApiResponse<T> {
  data: T;
  error: null | string;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}
