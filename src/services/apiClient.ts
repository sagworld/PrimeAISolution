export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function csrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const prefix = '__Host-prime_csrf='
  const cookie = document.cookie.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  return cookie ? cookie.slice(prefix.length) : null
}

export async function requestApiJson<T>(
  path: string,
  parse: (value: unknown) => T,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers(options.headers)
  let body: BodyInit | undefined
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body
    } else {
      headers.set('content-type', 'application/json')
      body = JSON.stringify(options.body)
    }
  }
  if (method !== 'GET') {
    const csrfToken = csrfTokenFromCookie()
    if (csrfToken) headers.set('x-csrf-token', csrfToken)
  }

  const response = await fetch(path, {
    method,
    headers,
    body,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
  })
  const responseText = await response.text()
  let responseBody: unknown
  if (responseText.trim()) {
    try {
      responseBody = JSON.parse(responseText) as unknown
    } catch {
      throw new ApiError('The server returned an invalid response.', response.status)
    }
  }

  if (!response.ok) {
    const message = isRecord(responseBody) && typeof responseBody.error === 'string'
      ? responseBody.error
      : `The request failed with status ${response.status}.`
    throw new ApiError(message, response.status)
  }
  if (responseBody === undefined) {
    throw new ApiError('The server returned an empty response.', response.status)
  }
  return parse(responseBody)
}
