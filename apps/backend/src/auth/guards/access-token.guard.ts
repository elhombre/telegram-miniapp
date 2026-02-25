import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { JwtService } from '@nestjs/jwt'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { Reflector } from '@nestjs/core'
import { UserRole } from '../../generated/prisma/client'
import type { Request } from 'express'
import { getEnv } from '../../config/env.schema'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { PrismaService } from '../../prisma/prisma.service'
import { PUBLIC_ROUTE_KEY } from '../decorators/public.decorator'
import type { AuthUser } from '../types/auth-user.type'

interface AccessTokenPayload {
  sub: string
  role: UserRole
  sessionId: string
  iat: number
  exp: number
}

type RequestWithUser = Request & { user?: AuthUser }

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly env = getEnv()

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>()
    const token = this.extractBearerToken(request)

    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_ACCESS_TOKEN',
        message: 'Missing bearer access token',
      })
    }

    const payload = await this.verifyAccessToken(token)
    await this.assertActiveSession(payload)

    request.user = {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sessionId,
    }

    return true
  }

  private extractBearerToken(request: Request): string | undefined {
    const authorization = request.header('authorization')
    if (!authorization) {
      return undefined
    }

    const [scheme, token] = authorization.split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined
    }

    return token
  }

  private async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      })

      if (!payload?.sub || !payload?.sessionId || !payload?.role) {
        throw new Error('Invalid access token payload')
      }

      if (!Object.values(UserRole).includes(payload.role)) {
        throw new Error('Invalid user role in access token')
      }

      return payload
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token is invalid or expired',
      })
    }
  }

  private async assertActiveSession(payload: AccessTokenPayload): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
      },
    })

    if (!session || session.userId !== payload.sub || session.revokedAt) {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token is invalid or expired',
      })
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token is invalid or expired',
      })
    }
  }
}
