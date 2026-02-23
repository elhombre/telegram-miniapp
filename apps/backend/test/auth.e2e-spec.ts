import { ValidationPipe } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { UserRole, type IdentityProvider } from './mocks/prisma-client.mock'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/prisma/prisma.service'

type JsonObject = Record<string, unknown>

interface UserRecord {
  id: string
  email: string | null
  emailVerifiedAt: Date | null
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

interface IdentityRecord {
  id: string
  userId: string
  provider: IdentityProvider
  providerUserId: string
  email: string | null
  passwordHash: string | null
  metadata: JsonObject | null
  createdAt: Date
  updatedAt: Date
}

interface SessionRecord {
  id: string
  userId: string
  refreshTokenHash: string
  userAgent: string | null
  ip: string | null
  expiresAt: Date
  revokedAt: Date | null
  replacedBySessionId: string | null
  createdAt: Date
}

interface AccountLinkTokenRecord {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  consumedAt: Date | null
  createdAt: Date
}

interface InMemoryState {
  users: UserRecord[]
  identities: IdentityRecord[]
  sessions: SessionRecord[]
  linkTokens: AccountLinkTokenRecord[]
}

interface UserCreateData {
  email?: string | null
  emailVerifiedAt?: Date | null
  role?: UserRole
  identities?: {
    create: {
      provider: IdentityProvider
      providerUserId: string
      email?: string | null
      passwordHash?: string | null
      metadata?: JsonObject
    }
  }
}

interface IdentityCreateData {
  provider: IdentityProvider
  providerUserId: string
  email?: string | null
  passwordHash?: string | null
  metadata?: unknown
  user: {
    connect: {
      id: string
    }
  }
}

interface SessionCreateData {
  userId: string
  refreshTokenHash: string
  userAgent?: string | null
  ip?: string | null
  expiresAt: Date
}

interface SelectShape {
  [key: string]: boolean | undefined
}

function createPrismaMock(state: InMemoryState) {
  let idSequence = 0

  const nextId = (prefix: string): string => {
    idSequence += 1
    return `${prefix}_${idSequence}`
  }

  const pickSelected = <T extends JsonObject>(record: T, select?: SelectShape): JsonObject => {
    if (!select) {
      return { ...record }
    }

    const selected: JsonObject = {}
    for (const [key, enabled] of Object.entries(select)) {
      if (enabled && key in record) {
        selected[key] = record[key]
      }
    }

    return selected
  }

  const buildIdentityWithUser = (identity: IdentityRecord, userSelect?: SelectShape): JsonObject => {
    const user = state.users.find(candidate => candidate.id === identity.userId)
    if (!user) {
      return { ...identity, user: null }
    }

    return {
      ...identity,
      user: pickSelected(user as unknown as JsonObject, userSelect),
    }
  }

  const prismaMock = {
    user: {
      findUnique: async (args: { where: { email?: string; id?: string }; select?: SelectShape }) => {
        const match = args.where.email
          ? state.users.find(user => user.email === args.where.email)
          : state.users.find(user => user.id === args.where.id)

        if (!match) {
          return null
        }

        return pickSelected(match as unknown as JsonObject, args.select)
      },
      create: async (args: { data: UserCreateData; select?: SelectShape }) => {
        const now = new Date()
        const user: UserRecord = {
          id: nextId('usr'),
          email: args.data.email ?? null,
          emailVerifiedAt: args.data.emailVerifiedAt ?? null,
          role: args.data.role ?? UserRole.USER,
          createdAt: now,
          updatedAt: now,
        }

        state.users.push(user)

        const identityCreate = args.data.identities?.create
        if (identityCreate) {
          const identity: IdentityRecord = {
            id: nextId('idt'),
            userId: user.id,
            provider: identityCreate.provider,
            providerUserId: identityCreate.providerUserId,
            email: identityCreate.email ?? null,
            passwordHash: identityCreate.passwordHash ?? null,
            metadata: (identityCreate.metadata ?? null) as JsonObject | null,
            createdAt: now,
            updatedAt: now,
          }
          state.identities.push(identity)
        }

        return pickSelected(user as unknown as JsonObject, args.select)
      },
      update: async (args: { where: { id: string }; data: { email?: string } }) => {
        const user = state.users.find(candidate => candidate.id === args.where.id)
        if (!user) {
          return null
        }

        if (typeof args.data.email !== 'undefined') {
          user.email = args.data.email
        }
        user.updatedAt = new Date()

        return { ...user }
      },
    },
    identity: {
      findUnique: async (args: {
        where: {
          provider_providerUserId?: {
            provider: IdentityProvider
            providerUserId: string
          }
        }
        select?: SelectShape
        include?: {
          user?: {
            select?: SelectShape
          }
        }
      }) => {
        const unique = args.where.provider_providerUserId
        if (!unique) {
          return null
        }

        const identity = state.identities.find(
          candidate =>
            candidate.provider === unique.provider && candidate.providerUserId === unique.providerUserId,
        )
        if (!identity) {
          return null
        }

        if (args.include?.user) {
          return buildIdentityWithUser(identity, args.include.user.select)
        }

        return pickSelected(identity as unknown as JsonObject, args.select)
      },
      create: async (args: { data: IdentityCreateData }) => {
        const now = new Date()
        const identity: IdentityRecord = {
          id: nextId('idt'),
          userId: args.data.user.connect.id,
          provider: args.data.provider,
          providerUserId: args.data.providerUserId,
          email: args.data.email ?? null,
          passwordHash: args.data.passwordHash ?? null,
          metadata: (args.data.metadata ?? null) as JsonObject | null,
          createdAt: now,
          updatedAt: now,
        }

        state.identities.push(identity)
        return { ...identity }
      },
    },
    session: {
      findUnique: async (args: {
        where: { refreshTokenHash?: string; id?: string }
        include?: {
          user?: {
            select?: SelectShape
          }
        }
        select?: SelectShape
      }) => {
        const session = args.where.refreshTokenHash
          ? state.sessions.find(candidate => candidate.refreshTokenHash === args.where.refreshTokenHash)
          : state.sessions.find(candidate => candidate.id === args.where.id)

        if (!session) {
          return null
        }

        if (args.include?.user) {
          const user = state.users.find(candidate => candidate.id === session.userId)
          return {
            ...session,
            user: user ? pickSelected(user as unknown as JsonObject, args.include.user.select) : null,
          }
        }

        return pickSelected(session as unknown as JsonObject, args.select)
      },
      create: async (args: { data: SessionCreateData; select?: SelectShape }) => {
        const session: SessionRecord = {
          id: nextId('ses'),
          userId: args.data.userId,
          refreshTokenHash: args.data.refreshTokenHash,
          userAgent: args.data.userAgent ?? null,
          ip: args.data.ip ?? null,
          expiresAt: args.data.expiresAt,
          revokedAt: null,
          replacedBySessionId: null,
          createdAt: new Date(),
        }

        state.sessions.push(session)
        return pickSelected(session as unknown as JsonObject, args.select)
      },
      update: async (args: {
        where: { id: string }
        data: { revokedAt?: Date; replacedBySessionId?: string }
      }) => {
        const session = state.sessions.find(candidate => candidate.id === args.where.id)
        if (!session) {
          return null
        }

        if (args.data.revokedAt) {
          session.revokedAt = args.data.revokedAt
        }

        if (args.data.replacedBySessionId) {
          session.replacedBySessionId = args.data.replacedBySessionId
        }

        return { ...session }
      },
    },
    accountLinkToken: {
      create: async (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const token: AccountLinkTokenRecord = {
          id: nextId('lnk'),
          userId: args.data.userId,
          tokenHash: args.data.tokenHash,
          expiresAt: args.data.expiresAt,
          consumedAt: null,
          createdAt: new Date(),
        }

        state.linkTokens.push(token)
        return { ...token }
      },
      findUnique: async (args: {
        where: { tokenHash: string }
        select?: SelectShape
      }) => {
        const token = state.linkTokens.find(candidate => candidate.tokenHash === args.where.tokenHash)
        if (!token) {
          return null
        }

        return pickSelected(token as unknown as JsonObject, args.select)
      },
      update: async (args: {
        where: { id: string }
        data: { consumedAt?: Date }
      }) => {
        const token = state.linkTokens.find(candidate => candidate.id === args.where.id)
        if (!token) {
          return null
        }

        if (args.data.consumedAt) {
          token.consumedAt = args.data.consumedAt
        }

        return { ...token }
      },
    },
    $transaction: async <T>(callback: (transaction: typeof prismaMock) => Promise<T>) => callback(prismaMock),
  }

  return prismaMock
}

describe('AuthController (e2e)', () => {
  let app: Awaited<ReturnType<TestingModule['createNestApplication']>>

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.PORT = '3000'
    process.env.API_PREFIX = 'api/v1'
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
    process.env.JWT_ACCESS_SECRET = 'test-access-secret'
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret'
    process.env.ACCESS_TOKEN_TTL_SECONDS = '900'
    process.env.REFRESH_TOKEN_TTL_DAYS = '30'
    process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = '86400'
    process.env.ACCOUNT_LINK_TOKEN_TTL_MINUTES = '10'

    const state: InMemoryState = {
      users: [],
      identities: [],
      sessions: [],
      linkTokens: [],
    }

    const prismaMock = createPrismaMock(state)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('executes register -> login -> refresh -> link -> logout flow', async () => {
    const registerResponse = await request(app.getHttpServer()).post('/api/v1/auth/email/register').send({
      email: 'user@example.com',
      password: 'StrongPass123',
    })

    expect(registerResponse.status).toBe(201)
    expect(registerResponse.body.user.email).toBe('user@example.com')
    expect(registerResponse.body.accessToken).toEqual(expect.any(String))
    expect(registerResponse.body.refreshToken).toEqual(expect.any(String))

    const loginResponse = await request(app.getHttpServer()).post('/api/v1/auth/email/login').send({
      email: 'user@example.com',
      password: 'StrongPass123',
    })

    expect(loginResponse.status).toBe(201)
    expect(loginResponse.body.accessToken).toEqual(expect.any(String))
    expect(loginResponse.body.refreshToken).toEqual(expect.any(String))

    const refreshResponse = await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({
      refreshToken: loginResponse.body.refreshToken,
    })

    expect(refreshResponse.status).toBe(201)
    expect(refreshResponse.body.refreshToken).toEqual(expect.any(String))
    expect(refreshResponse.body.refreshToken).not.toBe(loginResponse.body.refreshToken)

    const linkStartResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/link/start')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)

    expect(linkStartResponse.status).toBe(201)
    expect(linkStartResponse.body.linkToken).toEqual(expect.any(String))

    const linkConfirmResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/link/confirm')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .send({
        linkToken: linkStartResponse.body.linkToken,
        provider: 'email',
        email: 'linked@example.com',
        password: 'LinkedPass123',
      })

    expect(linkConfirmResponse.status).toBe(201)
    expect(linkConfirmResponse.body).toEqual({
      linked: true,
      provider: 'email',
    })

    const logoutResponse = await request(app.getHttpServer()).post('/api/v1/auth/logout').send({
      refreshToken: refreshResponse.body.refreshToken,
    })

    expect(logoutResponse.status).toBe(201)
    expect(logoutResponse.body).toEqual({ success: true })
  })

  it('returns 401 for protected endpoint without access token', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/link/start')
    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({
      code: 'MISSING_ACCESS_TOKEN',
      message: 'Missing bearer access token',
    })
  })
})
