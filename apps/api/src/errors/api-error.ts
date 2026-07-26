export type ApiErrorCode = 'unauthorized' | 'forbidden' | 'validation_error' | 'not_found' | 'conflict' | 'service_unavailable';
export interface ApiErrorBody { error: { code: ApiErrorCode; message: string } }
export class ApiError extends Error { constructor(public code: ApiErrorCode, message: string, public status = code === 'unauthorized' ? 401 : code === 'forbidden' ? 403 : code === 'validation_error' ? 400 : code === 'not_found' ? 404 : code === 'conflict' ? 409 : 503) { super(message); this.name = 'ApiError' } }
