import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { RateLimitModule } from '../common/rate-limit/rate-limit.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { ConsoleEmailSenderProvider } from './email/console-email-sender.provider'
import { MailerLiteEmailSenderProvider } from './email/mailerlite-email-sender.provider'
import { EmailSenderService } from './email-sender.service'
import { AccessTokenGuard } from './guards/access-token.guard'
import { RolesGuard } from './guards/roles.guard'

@Module({
  imports: [JwtModule.register({}), RateLimitModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailSenderService,
    ConsoleEmailSenderProvider,
    MailerLiteEmailSenderProvider,
    AccessTokenGuard,
    RolesGuard,
  ],
  exports: [AuthService, AccessTokenGuard, RolesGuard],
})
export class AuthModule {}
