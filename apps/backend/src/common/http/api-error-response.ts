export interface ApiErrorResponse {
  code: string
  message: string
  details?: unknown
  traceId: string
}

