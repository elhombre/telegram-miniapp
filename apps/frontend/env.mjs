const NODE_ENV_VALUES = ['development', 'test', 'production']
const APP_ENV_VALUES = ['development', 'staging', 'production']

export function loadFrontendEnv(rawEnv = process.env) {
  const errors = []

  const frontendEnv = {
    NODE_ENV: parseEnum(
      rawEnv.NODE_ENV,
      'NODE_ENV',
      NODE_ENV_VALUES,
      'development',
      errors,
    ),
    NEXT_PUBLIC_APP_ENV: parseEnum(
      rawEnv.NEXT_PUBLIC_APP_ENV,
      'NEXT_PUBLIC_APP_ENV',
      APP_ENV_VALUES,
      'development',
      errors,
    ),
    NEXT_PUBLIC_API_BASE_URL: parseApiBaseUrl(rawEnv.NEXT_PUBLIC_API_BASE_URL, errors),
  }

  if (errors.length > 0) {
    throw new Error(`Invalid frontend environment variables:\n${errors.map(error => `- ${error}`).join('\n')}`)
  }

  return Object.freeze(frontendEnv)
}

function parseApiBaseUrl(rawValue, errors) {
  const fallback = 'http://localhost:3000/api/v1'
  const value = (rawValue ?? fallback).trim()

  if (value.startsWith('/')) {
    return value.replace(/\/+$/, '') || '/'
  }

  try {
    const parsedUrl = new URL(value)
    return parsedUrl.toString().replace(/\/$/, '')
  } catch {
    errors.push(
      `NEXT_PUBLIC_API_BASE_URL must be an absolute URL or path starting with "/", got "${rawValue}"`,
    )
    return fallback
  }
}

function parseEnum(rawValue, variableName, allowed, fallback, errors) {
  const value = (rawValue ?? fallback).trim()

  if (allowed.includes(value)) {
    return value
  }

  errors.push(`${variableName} must be one of [${allowed.join(', ')}], got "${rawValue}"`)
  return fallback
}

