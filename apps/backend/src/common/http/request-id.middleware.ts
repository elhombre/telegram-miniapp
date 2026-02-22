import { Injectable, type NestMiddleware } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

type RequestWithTraceId = Request & { traceId?: string }

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const request = req as RequestWithTraceId
    const headerTraceId = req.header('x-request-id')
    const traceId = headerTraceId?.trim() ? headerTraceId.trim() : randomUUID()

    request.traceId = traceId
    res.setHeader('x-request-id', traceId)

    next()
  }
}
