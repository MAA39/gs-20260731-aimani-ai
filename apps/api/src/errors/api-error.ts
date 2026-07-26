export type ApiErrorCode = 'unauthorized' | 'forbidden' | 'validation_error' | 'service_unavailable';
export interface ApiErrorBody { error: { code: ApiErrorCode; message: string } }
export class ApiError extends Error { constructor(public code: ApiErrorCode, message: string, public status = code === 'unauthorized' ? 401 : code === 'forbidden' ? 403 : code === 'validation_error' ? 400 : 503) { super(message); this.name = 'ApiError' } }
