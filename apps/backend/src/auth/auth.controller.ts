import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '../generated/prisma/client'
import type { Request } from 'express'
import { AUTH_RATE_LIMIT_POLICIES } from '../common/rate-limit/policies/auth-rate-limit.policies'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { RateLimitService } from '../common/rate-limit/rate-limit.service'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import { Roles } from './decorators/roles.decorator'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { AuthService } from './auth.service'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { EmailLoginDto } from './dto/email-login.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { EmailRegisterDto } from './dto/email-register.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { GoogleCallbackDto } from './dto/google-callback.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { LinkEmailConfirmDto } from './dto/link-email-confirm.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { LinkEmailRequestDto } from './dto/link-email-request.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { LinkConfirmDto } from './dto/link-confirm.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { LogoutDto } from './dto/logout.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { RefreshTokenDto } from './dto/refresh-token.dto'
// biome-ignore lint/style/useImportType: Nest validation metadata requires DTO runtime class reference.
import { TelegramVerifyInitDataDto } from './dto/telegram-verify-init-data.dto'
import { AccessTokenGuard } from './guards/access-token.guard'
import { RolesGuard } from './guards/roles.guard'
import type { AuthUser } from './types/auth-user.type'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Post('telegram/verify-init-data')
  @Public()
  async verifyTelegramInitData(@Body() dto: TelegramVerifyInitDataDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.TELEGRAM_VERIFY_INIT_DATA, { request })
    return this.authService.loginWithTelegram(dto, request)
  }

  @Post('email/register')
  @Public()
  async registerWithEmail(@Body() dto: EmailRegisterDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.EMAIL_REGISTER, {
      request,
      email: dto.email,
    })
    return this.authService.registerWithEmail(dto, request)
  }

  @Post('email/login')
  @Public()
  async loginWithEmail(@Body() dto: EmailLoginDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.EMAIL_LOGIN, {
      request,
      email: dto.email,
    })
    return this.authService.loginWithEmail(dto, request)
  }

  @Post('google/callback')
  @Public()
  async loginWithGoogle(@Body() dto: GoogleCallbackDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.GOOGLE_CALLBACK, { request })
    return this.authService.loginWithGoogle(dto, request)
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.REFRESH, {
      request,
      refreshToken: dto.refreshToken,
    })
    return this.authService.refreshSession(dto, request)
  }

  @Post('logout')
  @Public()
  async logout(@Body() dto: LogoutDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.LOGOUT, {
      request,
      refreshToken: dto.refreshToken,
    })
    return this.authService.logout(dto)
  }

  @Post('link/start')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  async startLink(@CurrentUser() user: AuthUser, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.LINK_START, {
      request,
      userId: user.userId,
    })
    return this.authService.startLink(user)
  }

  @Post('link/confirm')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  async confirmLink(@CurrentUser() user: AuthUser, @Body() dto: LinkConfirmDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.LINK_CONFIRM, {
      request,
      userId: user.userId,
    })
    return this.authService.confirmLink(user, dto)
  }

  @Post('link/email/request')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  async requestEmailLink(@CurrentUser() user: AuthUser, @Body() dto: LinkEmailRequestDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.LINK_EMAIL_REQUEST, {
      request,
      userId: user.userId,
      email: dto.email,
    })
    return this.authService.requestEmailLink(user, dto)
  }

  @Post('link/email/confirm')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  async confirmEmailLink(@CurrentUser() user: AuthUser, @Body() dto: LinkEmailConfirmDto, @Req() request: Request) {
    await this.rateLimitService.assert(AUTH_RATE_LIMIT_POLICIES.LINK_EMAIL_CONFIRM, {
      request,
      userId: user.userId,
      email: dto.email,
    })
    return this.authService.confirmEmailLink(user, dto)
  }
}
