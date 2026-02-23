import type { UserRole } from '../../generated/prisma/client'

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {
    id: string
    role: UserRole
    email: string | null
  }
}
