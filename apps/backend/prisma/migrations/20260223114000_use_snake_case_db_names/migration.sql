-- Rename enum types to snake_case.
ALTER TYPE "UserRole" RENAME TO user_role;
ALTER TYPE "IdentityProvider" RENAME TO identity_provider;

-- Rename tables to snake_case.
ALTER TABLE "User" RENAME TO users;
ALTER TABLE "Identity" RENAME TO identities;
ALTER TABLE "Session" RENAME TO sessions;
ALTER TABLE "AccountLinkToken" RENAME TO account_link_tokens;

-- Rename columns to snake_case.
ALTER TABLE users RENAME COLUMN "emailVerifiedAt" TO email_verified_at;
ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;

ALTER TABLE identities RENAME COLUMN "userId" TO user_id;
ALTER TABLE identities RENAME COLUMN "providerUserId" TO provider_user_id;
ALTER TABLE identities RENAME COLUMN "passwordHash" TO password_hash;
ALTER TABLE identities RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE identities RENAME COLUMN "updatedAt" TO updated_at;

ALTER TABLE sessions RENAME COLUMN "userId" TO user_id;
ALTER TABLE sessions RENAME COLUMN "refreshTokenHash" TO refresh_token_hash;
ALTER TABLE sessions RENAME COLUMN "userAgent" TO user_agent;
ALTER TABLE sessions RENAME COLUMN "expiresAt" TO expires_at;
ALTER TABLE sessions RENAME COLUMN "revokedAt" TO revoked_at;
ALTER TABLE sessions RENAME COLUMN "replacedBySessionId" TO replaced_by_session_id;
ALTER TABLE sessions RENAME COLUMN "createdAt" TO created_at;

ALTER TABLE account_link_tokens RENAME COLUMN "userId" TO user_id;
ALTER TABLE account_link_tokens RENAME COLUMN "tokenHash" TO token_hash;
ALTER TABLE account_link_tokens RENAME COLUMN "expiresAt" TO expires_at;
ALTER TABLE account_link_tokens RENAME COLUMN "consumedAt" TO consumed_at;
ALTER TABLE account_link_tokens RENAME COLUMN "createdAt" TO created_at;

-- Rename constraints to snake_case.
ALTER TABLE users RENAME CONSTRAINT "User_pkey" TO users_pkey;
ALTER TABLE identities RENAME CONSTRAINT "Identity_pkey" TO identities_pkey;
ALTER TABLE sessions RENAME CONSTRAINT "Session_pkey" TO sessions_pkey;
ALTER TABLE account_link_tokens RENAME CONSTRAINT "AccountLinkToken_pkey" TO account_link_tokens_pkey;

ALTER TABLE identities RENAME CONSTRAINT "Identity_userId_fkey" TO identities_user_id_fkey;
ALTER TABLE sessions RENAME CONSTRAINT "Session_userId_fkey" TO sessions_user_id_fkey;
ALTER TABLE account_link_tokens RENAME CONSTRAINT "AccountLinkToken_userId_fkey" TO account_link_tokens_user_id_fkey;

-- Rename indexes to snake_case.
ALTER INDEX "User_email_key" RENAME TO users_email_key;

ALTER INDEX "Identity_userId_idx" RENAME TO identities_user_id_idx;
ALTER INDEX "Identity_provider_providerUserId_key" RENAME TO identities_provider_provider_user_id_key;

ALTER INDEX "Session_refreshTokenHash_key" RENAME TO sessions_refresh_token_hash_key;
ALTER INDEX "Session_userId_idx" RENAME TO sessions_user_id_idx;
ALTER INDEX "Session_expiresAt_idx" RENAME TO sessions_expires_at_idx;

ALTER INDEX "AccountLinkToken_tokenHash_key" RENAME TO account_link_tokens_token_hash_key;
ALTER INDEX "AccountLinkToken_userId_idx" RENAME TO account_link_tokens_user_id_idx;
ALTER INDEX "AccountLinkToken_expiresAt_idx" RENAME TO account_link_tokens_expires_at_idx;
