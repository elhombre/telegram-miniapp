import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '../generated/prisma/client'
import type { Request } from 'express'
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
  constructor(private readonly authService: AuthService) {}

  @Post('telegram/verify-init-data')
  @Public()
  verifyTelegramInitData(@Body() dto: TelegramVerifyInitDataDto, @Req() request: Request) {
    return this.authService.loginWithTelegram(dto, request)
  }

  @Post('email/register')
  @Public()
  registerWithEmail(@Body() dto: EmailRegisterDto, @Req() request: Request) {
    return this.authService.registerWithEmail(dto, request)
  }

  @Post('email/login')
  @Public()
  loginWithEmail(@Body() dto: EmailLoginDto, @Req() request: Request) {
    return this.authService.loginWithEmail(dto, request)
  }

  @Post('google/callback')
  @Public()
  loginWithGoogle(@Body() dto: GoogleCallbackDto, @Req() request: Request) {
    return this.authService.loginWithGoogle(dto, request)
  }

  @Post('refresh')
  @Public()
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refreshSession(dto, request)
  }

  @Post('logout')
  @Public()
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto)
  }

  @Post('link/start')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  startLink(@CurrentUser() user: AuthUser) {
    return this.authService.startLink(user)
  }

  @Post('link/confirm')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  confirmLink(@CurrentUser() user: AuthUser, @Body() dto: LinkConfirmDto) {
    return this.authService.confirmLink(user, dto)
  }

  @Post('link/email/request')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  requestEmailLink(@CurrentUser() user: AuthUser, @Body() dto: LinkEmailRequestDto) {
    return this.authService.requestEmailLink(user, dto)
  }

  @Post('link/email/confirm')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.ADMIN)
  confirmEmailLink(@CurrentUser() user: AuthUser, @Body() dto: LinkEmailConfirmDto) {
    return this.authService.confirmEmailLink(user, dto)
  }
}
