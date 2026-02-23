import { Injectable } from '@nestjs/common'
import { getEnv } from '../config/env.schema'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { ConsoleEmailSenderProvider } from './email/console-email-sender.provider'
import type { EmailLinkVerificationPayload } from './email/email-sender-provider'
// biome-ignore lint/style/useImportType: Nest DI requires runtime class reference.
import { MailerLiteEmailSenderProvider } from './email/mailerlite-email-sender.provider'

@Injectable()
export class EmailSenderService {
  private readonly env = getEnv()

  constructor(
    private readonly consoleProvider: ConsoleEmailSenderProvider,
    private readonly mailerLiteProvider: MailerLiteEmailSenderProvider,
  ) {}

  async sendEmailLinkVerification(payload: EmailLinkVerificationPayload): Promise<void> {
    const provider = this.resolveProvider()
    await provider.sendEmailLinkVerification(payload)
  }

  private resolveProvider() {
    if (this.env.EMAIL_PROVIDER === 'mailerlite') {
      return this.mailerLiteProvider
    }

    return this.consoleProvider
  }
}

export type { EmailLinkVerificationPayload } from './email/email-sender-provider'
