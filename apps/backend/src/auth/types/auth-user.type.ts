import type { UserRole } from '../../generated/prisma/client'

export interface AuthUser {
  userId: string
  role: UserRole
  sessionId: string
}
