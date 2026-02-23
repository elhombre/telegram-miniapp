import { CallHandler, ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common'
import type { Request, Response } from 'express'
import { finalize, type Observable } from 'rxjs'

type RequestWithTraceId = Request & { traceId?: string }

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle()
    }

    const httpContext = context.switchToHttp()
    const request = httpContext.getRequest<RequestWithTraceId>()
    const response = httpContext.getResponse<Response>()
    const startedAt = process.hrtime.bigint()

    return next.handle().pipe(
      finalize(() => {
        const finishedAt = process.hrtime.bigint()
        const durationMs = Number(finishedAt - startedAt) / 1_000_000

        this.logger.log(
          JSON.stringify({
            event: 'http_request',
            traceId: request.traceId,
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
          }),
        )
      }),
    )
  }
}
