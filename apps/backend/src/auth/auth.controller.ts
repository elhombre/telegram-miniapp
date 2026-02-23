import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { UserRole } from '../generated/prisma/client'
import type { Request } from 'express'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import { Roles } from './decorators/roles.decorator'
import { AuthService } from './auth.service'
import { EmailLoginDto } from './dto/email-login.dto'
import { EmailRegisterDto } from './dto/email-register.dto'
import { GoogleCallbackDto } from './dto/google-callback.dto'
import { LinkConfirmDto } from './dto/link-confirm.dto'
import { LogoutDto } from './dto/logout.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
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
}
