import { loadFrontendEnv } from './env.mjs'

const env = loadFrontendEnv()

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_ENV: env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_API_MODE: env.NEXT_PUBLIC_API_MODE,
    NEXT_PUBLIC_DIRECT_API_BASE_URL: env.NEXT_PUBLIC_DIRECT_API_BASE_URL ?? '',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '',
  },
}

export default nextConfig;
