export interface IApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface IApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type TApiResponse<T> = IApiSuccess<T> | IApiError;

export interface IApiPaginationMeta {
  page: number;
  total: number;
  pageSize?: number;
}
