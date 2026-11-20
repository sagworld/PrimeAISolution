import { requestApiJson } from '@/services/apiClient'

export type AuthRole = 'owner' | 'lab-technician' | 'sample-collector'

export type AuthenticatedUser = {
  id: string
  username: string
  role: AuthRole
  labTechnicianId: string | null
  sampleCollectorId: string | null
}

export type AuthSession = {
  user: AuthenticatedUser
  csrfToken: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): never {
  throw new Error('The server returned invalid authentication data.')
}

function parseUser(value: unknown): AuthenticatedUser {
  if (!isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.username !== 'string' ||
    (value.role !== 'owner' && value.role !== 'lab-technician' && value.role !== 'sample-collector') ||
    !(typeof value.labTechnicianId === 'string' || value.labTechnicianId === null) ||
    !(typeof value.sampleCollectorId === 'string' || value.sampleCollectorId === null)) {
    return invalidResponse()
  }
  return {
    id: value.id,
    username: value.username,
    role: value.role,
    labTechnicianId: value.labTechnicianId,
    sampleCollectorId: value.sampleCollectorId,
  }
}

function parseSession(value: unknown): AuthSession {
  if (!isRecord(value) || typeof value.csrfToken !== 'string') return invalidResponse()
  return { user: parseUser(value.user), csrfToken: value.csrfToken }
}

function parseLogout(value: unknown): { status: 'signed-out' } {
  if (!isRecord(value) || value.status !== 'signed-out') return invalidResponse()
  return { status: 'signed-out' }
}

export function signIn(username: string, password: string): Promise<AuthSession> {
  return requestApiJson('/api/auth/login', parseSession, {
    method: 'POST',
    body: { username, password },
  })
}

export function getCurrentSession(): Promise<AuthSession> {
  return requestApiJson('/api/auth/me', parseSession)
}

export function signOut(): Promise<{ status: 'signed-out' }> {
  return requestApiJson('/api/auth/logout', parseLogout, { method: 'POST' })
}
