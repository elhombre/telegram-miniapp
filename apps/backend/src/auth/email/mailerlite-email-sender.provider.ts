import { Injectable, Logger } from '@nestjs/common'
import MailerLite from '@mailerlite/mailerlite-nodejs'
import { createHash } from 'node:crypto'
import { getEnv } from '../../config/env.schema'
import type { EmailLinkVerificationPayload, EmailSenderProvider } from './email-sender-provider'

@Injectable()
export class MailerLiteEmailSenderProvider implements EmailSenderProvider {
  private readonly env = getEnv()
  private readonly logger = new Logger(MailerLiteEmailSenderProvider.name)
  private readonly mailerLiteClient = new MailerLite({
    api_key: this.env.MAILERLITE_TOKEN ?? '',
  })

  async sendEmailLinkVerification(payload: EmailLinkVerificationPayload): Promise<void> {
    if (!this.env.MAILERLITE_TOKEN) {
      throw new Error('MAILERLITE_TOKEN is not configured')
    }

    if (!this.env.EMAIL_FROM_EMAIL) {
      throw new Error('EMAIL_FROM_EMAIL is not configured')
    }

    const groupId = await this.findOrCreateRecipientGroup(payload.to)

    await this.mailerLiteClient.subscribers.createOrUpdate({
      email: payload.to,
      status: 'active',
      groups: [groupId],
    })

    const campaignResponse = await this.mailerLiteClient.campaigns.create({
      name: `auth-link-${Date.now()}`,
      type: 'regular',
      groups: [groupId],
      emails: [
        {
          subject: 'Confirm your email linking request',
          from_name: this.env.EMAIL_FROM_NAME,
          from: this.env.EMAIL_FROM_EMAIL,
          content: this.renderHtml(payload),
        },
      ],
    })

    const campaignId = campaignResponse.data.data.id
    await this.mailerLiteClient.campaigns.schedule(campaignId, { delivery: 'instant' })

    this.logger.log(
      JSON.stringify({
        event: 'auth_email_link_verification_mailerlite_dispatched',
        to: payload.to,
        groupId,
        campaignId,
      }),
    )
  }

  private async findOrCreateRecipientGroup(email: string): Promise<string> {
    const groupName = this.getGroupName(email)
    const response = await this.mailerLiteClient.groups.get({
      limit: 1,
      page: 1,
      filter: { name: groupName },
      sort: '-created_at',
    })

    const existingGroup = response.data.data.find(group => group.name === groupName)
    if (existingGroup) {
      return existingGroup.id
    }

    const createdGroupResponse = await this.mailerLiteClient.groups.create({
      name: groupName,
    })

    return createdGroupResponse.data.data.id
  }

  private getGroupName(email: string): string {
    const hash = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 20)
    return `auth-link-${hash}`
  }

  private renderHtml(payload: EmailLinkVerificationPayload): string {
    const expiresAt = payload.expiresAt.toISOString()
    const linkSection = payload.confirmUrl
      ? `<p><a href="${payload.confirmUrl}">Open confirmation link</a></p>`
      : ''

    return [
      '<h2>Email Linking Confirmation</h2>',
      `<p>Your verification code is: <strong>${payload.code}</strong></p>`,
      `<p>Code expires at: ${expiresAt}</p>`,
      linkSection,
      '<p>If you did not request this action, ignore this email.</p>',
    ].join('')
  }
}
