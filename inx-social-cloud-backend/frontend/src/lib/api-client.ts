import { getStoredAuthToken, invalidateAuthSession } from './auth-session'

export { getStoredAuthToken } from './auth-session'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getStoredAuthToken()

  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers,
  })
  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String(payload.error)
      : `Request failed (HTTP ${response.status}).`

    if (response.status === 401 || (response.status === 403 && /bearer|token|auth|session/i.test(message))) {
      invalidateAuthSession('expired', 'api-client')
    }

    throw new ApiError(message, response.status)
  }

  return payload as T
}
