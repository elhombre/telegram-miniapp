import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ApiErrorResponse } from './api-error-response'

interface HttpExceptionLike {
  code?: unknown
  message?: unknown
  error?: unknown
  statusCode?: unknown
  [key: string]: unknown
}

type RequestWithTraceId = Request & { traceId?: string }

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const response = context.getResponse<Response>()
    const request = context.getRequest<RequestWithTraceId>()
    const traceId = request.traceId ?? 'unknown'

    const payload = this.buildPayload(exception, traceId)

    if (payload.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({
          event: 'http_error',
          traceId,
          method: request.method,
          path: request.originalUrl ?? request.url,
          statusCode: payload.statusCode,
          code: payload.code,
          message: payload.message,
        }),
        exception instanceof Error ? exception.stack : undefined,
      )
    }

    const responseBody: ApiErrorResponse = {
      code: payload.code,
      message: payload.message,
      details: payload.details,
      traceId,
    }

    response.status(payload.statusCode).json(responseBody)
  }

  private buildPayload(
    exception: unknown,
    traceId: string,
  ): { statusCode: number; code: string; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus()
      const response = exception.getResponse()
      const responseBody = this.normalizeResponseBody(response)
      const code = this.extractCode(responseBody.code, statusCode)
      const message = this.extractMessage(responseBody.message, exception.message, statusCode)
      const details = this.extractDetails(responseBody)

      return {
        statusCode,
        code,
        message,
        details,
      }
    }

    this.logger.error(
      JSON.stringify({
        event: 'unhandled_exception',
        traceId,
      }),
      exception instanceof Error ? exception.stack : undefined,
    )

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    }
  }

  private normalizeResponseBody(response: string | object): HttpExceptionLike {
    if (typeof response === 'string') {
      return { message: response }
    }

    return response as HttpExceptionLike
  }

  private extractCode(rawCode: unknown, statusCode: number): string {
    if (typeof rawCode === 'string' && rawCode.trim()) {
      return rawCode
    }

    return HttpStatus[statusCode] ?? `HTTP_${statusCode}`
  }

  private extractMessage(rawMessage: unknown, fallback: string, statusCode: number): string {
    if (typeof rawMessage === 'string' && rawMessage.trim()) {
      return rawMessage
    }

    if (Array.isArray(rawMessage)) {
      return rawMessage.map(item => String(item)).join('; ')
    }

    if (fallback.trim()) {
      return fallback
    }

    return HttpStatus[statusCode] ?? 'Request failed'
  }

  private extractDetails(responseBody: HttpExceptionLike): unknown {
    const { code, message, error, statusCode, ...details } = responseBody

    if (error !== undefined && details.error === undefined) {
      details.error = error
    }

    if (Object.keys(details).length === 0) {
      return undefined
    }

    return details
  }
}
