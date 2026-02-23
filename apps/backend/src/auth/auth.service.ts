import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { JwtService } from '@nestjs/jwt'
import { IdentityProvider, type Prisma, type UserRole } from '../generated/prisma/client'
import argon2 from 'argon2'
import type { Request } from 'express'
import { OAuth2Client, type TokenPayload } from 'google-auth-library'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getEnv } from '../config/env.schema'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { PrismaService } from '../prisma/prisma.service'
import type { EmailLoginDto } from './dto/email-login.dto'
import type { EmailRegisterDto } from './dto/email-register.dto'
import type { GoogleCallbackDto } from './dto/google-callback.dto'
import type { LinkEmailConfirmDto } from './dto/link-email-confirm.dto'
import type { LinkEmailRequestDto } from './dto/link-email-request.dto'
import { type LinkConfirmDto, LinkProviderDto } from './dto/link-confirm.dto'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { EmailSenderService } from './email-sender.service'
import type { LogoutDto } from './dto/logout.dto'
import type { RefreshTokenDto } from './dto/refresh-token.dto'
import type { TelegramVerifyInitDataDto } from './dto/telegram-verify-init-data.dto'
import type { AuthResponse } from './types/auth-response.type'
import type { AuthUser } from './types/auth-user.type'

interface TelegramUser {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
  is_premium?: boolean
}

interface AccessTokenPayload {
  sub: string
  role: UserRole
  sessionId: string
}

interface UserContext {
  id: string
  role: UserRole
  email: string | null
}

@Injectable()
export class AuthService {
  private readonly env = getEnv()
  private googleClient?: OAuth2Client

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailSender: EmailSenderService,
  ) {}

  async registerWithEmail(dto: EmailRegisterDto, request: Request): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email)

    const existingEmailIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider: IdentityProvider.EMAIL,
          providerUserId: email,
        },
      },
      select: { id: true },
    })

    if (existingEmailIdentity) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Email already registered',
      })
    }

    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUserByEmail) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'Email is already in use by another account',
      })
    }

    const passwordHash = await argon2.hash(dto.password)

    const user = await this.prisma.user.create({
      data: {
        email,
        identities: {
          create: {
            provider: IdentityProvider.EMAIL,
            providerUserId: email,
            email,
            passwordHash,
          },
        },
      },
      select: {
        id: true,
        role: true,
        email: true,
      },
    })

    return this.issueAuthSession(user, request)
  }

  async loginWithEmail(dto: EmailLoginDto, request: Request): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email)

    const identity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider: IdentityProvider.EMAIL,
          providerUserId: email,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            email: true,
          },
        },
      },
    })

    if (!identity?.passwordHash || !identity.user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      })
    }

    const isValidPassword = await argon2.verify(identity.passwordHash, dto.password)
    if (!isValidPassword) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      })
    }

    return this.issueAuthSession(identity.user, request)
  }

  async loginWithGoogle(dto: GoogleCallbackDto, request: Request): Promise<AuthResponse> {
    const payload = await this.verifyGoogleIdToken(dto.idToken)

    const existingGoogleIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider: IdentityProvider.GOOGLE,
          providerUserId: payload.sub,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            email: true,
          },
        },
      },
    })

    if (existingGoogleIdentity?.user) {
      return this.issueAuthSession(existingGoogleIdentity.user, request)
    }

    const email = payload.email ? this.normalizeEmail(payload.email) : null

    if (email) {
      const userWithSameEmail = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (userWithSameEmail) {
        throw new ConflictException({
          code: 'ACCOUNT_LINK_REQUIRED',
          message: 'An account with this email already exists. Link identities explicitly.',
        })
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        emailVerifiedAt: payload.email_verified ? new Date() : null,
        identities: {
          create: {
            provider: IdentityProvider.GOOGLE,
            providerUserId: payload.sub,
            email,
            metadata: {
              name: payload.name,
              picture: payload.picture,
              locale: payload.locale,
              emailVerified: payload.email_verified,
            },
          },
        },
      },
      select: {
        id: true,
        role: true,
        email: true,
      },
    })

    return this.issueAuthSession(user, request)
  }

  async loginWithTelegram(dto: TelegramVerifyInitDataDto, request: Request): Promise<AuthResponse> {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_AUTH_DISABLED',
        message: 'Telegram auth is not configured',
      })
    }

    const telegramUser = this.verifyTelegramInitData(dto.initDataRaw)
    const providerUserId = String(telegramUser.id)

    const existingTelegramIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider: IdentityProvider.TELEGRAM,
          providerUserId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            email: true,
          },
        },
      },
    })

    if (existingTelegramIdentity?.user) {
      return this.issueAuthSession(existingTelegramIdentity.user, request)
    }

    const user = await this.prisma.user.create({
      data: {
        identities: {
          create: {
            provider: IdentityProvider.TELEGRAM,
            providerUserId,
            metadata: {
              username: telegramUser.username,
              firstName: telegramUser.first_name,
              lastName: telegramUser.last_name,
              languageCode: telegramUser.language_code,
              isPremium: telegramUser.is_premium,
            },
          },
        },
      },
      select: {
        id: true,
        role: true,
        email: true,
      },
    })

    return this.issueAuthSession(user, request)
  }

  async refreshSession(dto: RefreshTokenDto, request: Request): Promise<AuthResponse> {
    const refreshTokenHash = this.hashToken(dto.refreshToken)

    const existingSession = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            email: true,
          },
        },
      },
    })

    if (!existingSession?.user || existingSession.revokedAt || existingSession.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
      })
    }

    const context = this.extractRequestContext(request)
    const now = new Date()
    const refreshToken = this.generateSecureToken()
    const newRefreshTokenHash = this.hashToken(refreshToken)

    const newSession = await this.prisma.$transaction(async tx => {
      const createdSession = await tx.session.create({
        data: {
          userId: existingSession.userId,
          refreshTokenHash: newRefreshTokenHash,
          userAgent: context.userAgent,
          ip: context.ip,
          expiresAt: new Date(now.getTime() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      })

      await tx.session.update({
        where: { id: existingSession.id },
        data: {
          revokedAt: now,
          replacedBySessionId: createdSession.id,
        },
      })

      return createdSession
    })

    const accessToken = await this.signAccessToken(existingSession.user.id, existingSession.user.role, newSession.id)

    return {
      accessToken,
      refreshToken,
      expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: existingSession.user.id,
        role: existingSession.user.role,
        email: existingSession.user.email,
      },
    }
  }

  async logout(dto: LogoutDto): Promise<{ success: true }> {
    const refreshTokenHash = this.hashToken(dto.refreshToken)

    const existingSession = await this.prisma.session.findUnique({
      where: { refreshTokenHash },
      select: { id: true, revokedAt: true },
    })

    if (existingSession && !existingSession.revokedAt) {
      await this.prisma.session.update({
        where: { id: existingSession.id },
        data: { revokedAt: new Date() },
      })
    }

    return { success: true }
  }

  async startLink(user: AuthUser): Promise<{ linkToken: string; expiresAt: string }> {
    const rawToken = this.generateSecureToken()
    const tokenHash = this.hashToken(rawToken)
    const expiresAt = new Date(Date.now() + this.env.ACCOUNT_LINK_TOKEN_TTL_MINUTES * 60 * 1000)

    await this.prisma.accountLinkToken.create({
      data: {
        userId: user.userId,
        tokenHash,
        expiresAt,
      },
    })

    return {
      linkToken: rawToken,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async requestEmailLink(
    user: AuthUser,
    dto: LinkEmailRequestDto,
  ): Promise<{ sent: true; provider: LinkProviderDto.email; email: string; expiresAt: string }> {
    const normalizedEmail = this.normalizeEmail(dto.email)
    const linkToken = await this.resolveActiveLinkToken(user.userId, dto.linkToken)

    await this.assertEmailCanBeLinked(user.userId, normalizedEmail)

    const verificationCode = this.createEmailLinkCode(user.userId, dto.linkToken, normalizedEmail)
    const confirmUrl = this.buildEmailLinkConfirmUrl(dto.linkToken, normalizedEmail, verificationCode)

    try {
      await this.emailSender.sendEmailLinkVerification({
        to: normalizedEmail,
        code: verificationCode,
        expiresAt: linkToken.expiresAt,
        confirmUrl,
      })
    } catch {
      throw new ServiceUnavailableException({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Failed to deliver verification email',
      })
    }

    return {
      sent: true,
      provider: LinkProviderDto.email,
      email: this.maskEmail(normalizedEmail),
      expiresAt: linkToken.expiresAt.toISOString(),
    }
  }

  async confirmEmailLink(
    user: AuthUser,
    dto: LinkEmailConfirmDto,
  ): Promise<{ linked: true; provider: LinkProviderDto.email }> {
    const normalizedEmail = this.normalizeEmail(dto.email)
    const linkToken = await this.resolveActiveLinkToken(user.userId, dto.linkToken)
    const expectedCode = this.createEmailLinkCode(user.userId, dto.linkToken, normalizedEmail)

    if (!this.isSafeEqual(expectedCode, dto.code.trim())) {
      throw new UnauthorizedException({
        code: 'INVALID_EMAIL_LINK_CODE',
        message: 'Email verification code is invalid',
      })
    }

    await this.prisma.$transaction(async tx => {
      const existingIdentity = await tx.identity.findUnique({
        where: {
          provider_providerUserId: {
            provider: IdentityProvider.EMAIL,
            providerUserId: normalizedEmail,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      })

      if (existingIdentity && existingIdentity.userId !== user.userId) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_IN_USE',
          message: 'Email is already linked to another account',
        })
      }

      if (!existingIdentity) {
        const createData: Prisma.IdentityCreateInput = {
          provider: IdentityProvider.EMAIL,
          providerUserId: normalizedEmail,
          email: normalizedEmail,
          user: {
            connect: { id: user.userId },
          },
          metadata: {
            linkedVia: 'email_verification_code',
          } as Prisma.InputJsonValue,
        }

        await tx.identity.create({ data: createData })
      }

      const userRecord = await tx.user.findUnique({
        where: { id: user.userId },
        select: { email: true, emailVerifiedAt: true },
      })

      const userUpdateData: Prisma.UserUpdateInput = {}

      if (!userRecord?.email) {
        userUpdateData.email = normalizedEmail
        userUpdateData.emailVerifiedAt = new Date()
      } else if (userRecord.email === normalizedEmail && !userRecord.emailVerifiedAt) {
        userUpdateData.emailVerifiedAt = new Date()
      }

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: user.userId },
          data: userUpdateData,
        })
      }

      await tx.accountLinkToken.update({
        where: { id: linkToken.id },
        data: { consumedAt: new Date() },
      })
    })

    return {
      linked: true,
      provider: LinkProviderDto.email,
    }
  }

  async confirmLink(user: AuthUser, dto: LinkConfirmDto): Promise<{ linked: true; provider: LinkProviderDto }> {
    if (dto.provider === LinkProviderDto.email) {
      throw new BadRequestException({
        code: 'EMAIL_LINK_VERIFICATION_REQUIRED',
        message: 'Use /auth/link/email/request and /auth/link/email/confirm for email linking',
      })
    }

    const linkToken = await this.resolveActiveLinkToken(user.userId, dto.linkToken)

    const provider = this.mapLinkProvider(dto.provider)
    let normalizedEmail = dto.email ? this.normalizeEmail(dto.email) : undefined
    let verifiedProviderUserId: string | undefined
    let providerMetadata: Record<string, unknown> | undefined

    if (dto.provider === LinkProviderDto.google && dto.idToken?.trim()) {
      const payload = await this.verifyGoogleIdToken(dto.idToken)
      verifiedProviderUserId = payload.sub
      if (!normalizedEmail && payload.email) {
        normalizedEmail = this.normalizeEmail(payload.email)
      }

      providerMetadata = {
        name: payload.name,
        picture: payload.picture,
        locale: payload.locale,
        emailVerified: payload.email_verified,
      }
    }

    if (dto.provider === LinkProviderDto.telegram && dto.initDataRaw?.trim()) {
      const telegramUser = this.verifyTelegramLinkAuthData(dto.initDataRaw)
      verifiedProviderUserId = String(telegramUser.id)
      providerMetadata = {
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        languageCode: telegramUser.language_code,
        isPremium: telegramUser.is_premium,
      }
    }

    const providerUserId = this.resolveProviderUserId(
      dto.provider,
      dto.providerUserId,
      normalizedEmail,
      verifiedProviderUserId,
    )
    const mergedMetadata = this.mergeLinkMetadata(dto.metadata, providerMetadata)

    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (existingIdentity && existingIdentity.userId !== user.userId) {
      throw new ConflictException({
        code: 'IDENTITY_ALREADY_LINKED',
        message: 'This identity is already linked to another account',
      })
    }

    await this.prisma.$transaction(async tx => {
      if (!existingIdentity) {
        const createData: Prisma.IdentityCreateInput = {
          provider,
          providerUserId,
          email: normalizedEmail,
          metadata: mergedMetadata as Prisma.InputJsonValue | undefined,
          user: {
            connect: { id: user.userId },
          },
        }

        await tx.identity.create({ data: createData })
      }

      await tx.accountLinkToken.update({
        where: { id: linkToken.id },
        data: { consumedAt: new Date() },
      })
    })

    return {
      linked: true,
      provider: dto.provider,
    }
  }

  private async issueAuthSession(user: UserContext, request: Request): Promise<AuthResponse> {
    const context = this.extractRequestContext(request)
    const refreshToken = this.generateSecureToken()

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        userAgent: context.userAgent,
        ip: context.ip,
        expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    })

    const accessToken = await this.signAccessToken(user.id, user.role, session.id)

    return {
      accessToken,
      refreshToken,
      expiresIn: this.env.ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
      },
    }
  }

  private async signAccessToken(userId: string, role: UserRole, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: userId,
      role,
      sessionId,
    }

    return this.jwtService.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: `${this.env.ACCESS_TOKEN_TTL_SECONDS}s`,
    })
  }

  private extractRequestContext(request: Request): { userAgent: string | null; ip: string | null } {
    const userAgent = request.header('user-agent') ?? null
    const ip = request.ip || request.socket.remoteAddress || null

    return { userAgent, ip }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private generateSecureToken(bytes = 48): string {
    return randomBytes(bytes).toString('base64url')
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private mapLinkProvider(provider: LinkProviderDto): IdentityProvider {
    if (provider === LinkProviderDto.email) {
      return IdentityProvider.EMAIL
    }

    if (provider === LinkProviderDto.google) {
      return IdentityProvider.GOOGLE
    }

    return IdentityProvider.TELEGRAM
  }

  private resolveProviderUserId(
    provider: LinkProviderDto,
    providerUserId: string | undefined,
    normalizedEmail: string | undefined,
    verifiedProviderUserId: string | undefined,
  ): string {
    if (provider === LinkProviderDto.email) {
      if (!normalizedEmail) {
        throw new BadRequestException({
          code: 'EMAIL_REQUIRED',
          message: 'email is required for email identity linking',
        })
      }

      return normalizedEmail
    }

    if (verifiedProviderUserId?.trim()) {
      return verifiedProviderUserId.trim()
    }

    if (!providerUserId?.trim()) {
      throw new BadRequestException({
        code: 'PROVIDER_USER_ID_REQUIRED',
        message: 'providerUserId or provider auth payload is required for this provider',
      })
    }

    return providerUserId.trim()
  }

  private async resolveActiveLinkToken(
    userId: string,
    rawLinkToken: string,
  ): Promise<{ id: string; expiresAt: Date }> {
    const tokenHash = this.hashToken(rawLinkToken)

    const linkToken = await this.prisma.accountLinkToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        consumedAt: true,
        expiresAt: true,
      },
    })

    if (!linkToken || linkToken.userId !== userId) {
      throw new UnauthorizedException({
        code: 'INVALID_LINK_TOKEN',
        message: 'Link token is invalid',
      })
    }

    if (linkToken.consumedAt || linkToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'EXPIRED_LINK_TOKEN',
        message: 'Link token is expired or already used',
      })
    }

    return {
      id: linkToken.id,
      expiresAt: linkToken.expiresAt,
    }
  }

  private async assertEmailCanBeLinked(userId: string, normalizedEmail: string): Promise<void> {
    const existingEmailIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider: IdentityProvider.EMAIL,
          providerUserId: normalizedEmail,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    })

    if (existingEmailIdentity?.userId && existingEmailIdentity.userId !== userId) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'Email is already linked to another account',
      })
    }

    if (existingEmailIdentity?.userId === userId) {
      throw new ConflictException({
        code: 'IDENTITY_ALREADY_LINKED',
        message: 'This email is already linked',
      })
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser?.id && existingUser.id !== userId) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'Email is already in use by another account',
      })
    }
  }

  private createEmailLinkCode(userId: string, linkToken: string, normalizedEmail: string): string {
    const digest = createHmac('sha256', this.env.JWT_ACCESS_SECRET)
      .update(`email-link:${userId}:${linkToken}:${normalizedEmail}`)
      .digest('hex')

    const numericCode = Number.parseInt(digest.slice(0, 12), 16) % 1_000_000
    return numericCode.toString().padStart(6, '0')
  }

  private buildEmailLinkConfirmUrl(linkToken: string, normalizedEmail: string, code: string): string | undefined {
    if (!this.env.FRONTEND_ORIGIN) {
      return undefined
    }

    const url = new URL('/dashboard/linking', this.env.FRONTEND_ORIGIN)
    url.searchParams.set('link_provider', 'email')
    url.searchParams.set('link_token', linkToken)
    url.searchParams.set('link_email', normalizedEmail)
    url.searchParams.set('link_code', code)

    return url.toString()
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@')
    if (!localPart || !domain) {
      return email
    }

    if (localPart.length <= 2) {
      return `${localPart[0] ?? '*'}***@${domain}`
    }

    return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`
  }

  private isSafeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)

    if (leftBuffer.length !== rightBuffer.length) {
      return false
    }

    return timingSafeEqual(leftBuffer, rightBuffer)
  }

  private async verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
    if (!this.env.GOOGLE_CLIENT_ID) {
      throw new ServiceUnavailableException({
        code: 'GOOGLE_AUTH_DISABLED',
        message: 'Google auth is not configured',
      })
    }

    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(this.env.GOOGLE_CLIENT_ID)
    }

    let payload: TokenPayload | undefined

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.env.GOOGLE_CLIENT_ID,
      })
      payload = ticket.getPayload()
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google token is invalid',
      })
    }

    if (!payload?.sub) {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Google token payload is invalid',
      })
    }

    return payload
  }

  private mergeLinkMetadata(
    inputMetadata: Record<string, unknown> | undefined,
    providerMetadata: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    if (!inputMetadata && !providerMetadata) {
      return undefined
    }

    return {
      ...(inputMetadata ?? {}),
      ...(providerMetadata ?? {}),
    }
  }

  private verifyTelegramLinkAuthData(initDataRaw: string): TelegramUser {
    const params = new URLSearchParams(initDataRaw)

    if (params.get('user')) {
      return this.verifyTelegramInitData(initDataRaw)
    }

    if (params.get('id')) {
      return this.verifyTelegramLoginWidgetData(initDataRaw)
    }

    return this.verifyTelegramInitData(initDataRaw)
  }

  private verifyTelegramInitData(initDataRaw: string): TelegramUser {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_AUTH_DISABLED',
        message: 'Telegram auth is not configured',
      })
    }

    const params = new URLSearchParams(initDataRaw)
    const providedHash = params.get('hash')

    if (!providedHash || !/^[a-f0-9]{64}$/i.test(providedHash)) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram init data hash is missing or invalid',
      })
    }

    const authDateRaw = params.get('auth_date')
    const authDate = authDateRaw ? Number.parseInt(authDateRaw, 10) : Number.NaN

    if (!Number.isInteger(authDate) || authDate <= 0) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram auth_date is invalid',
      })
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds - authDate > this.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
      throw new UnauthorizedException({
        code: 'TELEGRAM_INIT_DATA_EXPIRED',
        message: 'Telegram init data is expired',
      })
    }

    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    const secretKey = createHmac('sha256', 'WebAppData').update(this.env.TELEGRAM_BOT_TOKEN).digest()
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    const expectedHashBuffer = Buffer.from(expectedHash, 'hex')
    const providedHashBuffer = Buffer.from(providedHash, 'hex')

    if (
      expectedHashBuffer.length !== providedHashBuffer.length ||
      !timingSafeEqual(expectedHashBuffer, providedHashBuffer)
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_SIGNATURE',
        message: 'Telegram init data signature is invalid',
      })
    }

    const userRaw = params.get('user')
    if (!userRaw) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram user payload is missing',
      })
    }

    let telegramUser: TelegramUser
    try {
      telegramUser = JSON.parse(userRaw) as TelegramUser
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram user payload is invalid JSON',
      })
    }

    if (!telegramUser?.id) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram user id is missing',
      })
    }

    return telegramUser
  }

  private verifyTelegramLoginWidgetData(initDataRaw: string): TelegramUser {
    if (!this.env.TELEGRAM_BOT_TOKEN) {
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_AUTH_DISABLED',
        message: 'Telegram auth is not configured',
      })
    }

    const params = new URLSearchParams(initDataRaw)
    const providedHash = params.get('hash')

    if (!providedHash || !/^[a-f0-9]{64}$/i.test(providedHash)) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram auth hash is missing or invalid',
      })
    }

    const authDateRaw = params.get('auth_date')
    const authDate = authDateRaw ? Number.parseInt(authDateRaw, 10) : Number.NaN

    if (!Number.isInteger(authDate) || authDate <= 0) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram auth_date is invalid',
      })
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds - authDate > this.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
      throw new UnauthorizedException({
        code: 'TELEGRAM_INIT_DATA_EXPIRED',
        message: 'Telegram auth data is expired',
      })
    }

    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    const secretKey = createHash('sha256').update(this.env.TELEGRAM_BOT_TOKEN).digest()
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

    const expectedHashBuffer = Buffer.from(expectedHash, 'hex')
    const providedHashBuffer = Buffer.from(providedHash, 'hex')

    if (
      expectedHashBuffer.length !== providedHashBuffer.length ||
      !timingSafeEqual(expectedHashBuffer, providedHashBuffer)
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_SIGNATURE',
        message: 'Telegram auth signature is invalid',
      })
    }

    const idRaw = params.get('id')
    const id = idRaw ? Number.parseInt(idRaw, 10) : Number.NaN

    if (!Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException({
        code: 'INVALID_TELEGRAM_INIT_DATA',
        message: 'Telegram user id is missing',
      })
    }

    return {
      id,
      username: params.get('username') ?? undefined,
      first_name: params.get('first_name') ?? undefined,
      last_name: params.get('last_name') ?? undefined,
    }
  }
}
