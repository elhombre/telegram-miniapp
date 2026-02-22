import { Injectable, Logger } from '@nestjs/common'
import type { EmailLinkVerificationPayload, EmailSenderProvider } from './email-sender-provider'

@Injectable()
export class ConsoleEmailSenderProvider implements EmailSenderProvider {
  private readonly logger = new Logger(ConsoleEmailSenderProvider.name)

  async sendEmailLinkVerification(payload: EmailLinkVerificationPayload): Promise<void> {
    const message = {
      event: 'auth_email_link_verification',
      to: payload.to,
      code: payload.code,
      expiresAt: payload.expiresAt.toISOString(),
      confirmUrl: payload.confirmUrl ?? null,
    }

    this.logger.log(JSON.stringify(message))
  }
}
