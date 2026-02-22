export interface EmailLinkVerificationPayload {
  to: string
  code: string
  expiresAt: Date
  confirmUrl?: string
}

export interface EmailSenderProvider {
  sendEmailLinkVerification(payload: EmailLinkVerificationPayload): Promise<void>
}
