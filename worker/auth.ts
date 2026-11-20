export interface AuthEnv {
  DB: D1Database
  ASSETS?: R2Bucket
  BOOTSTRAP_TOKEN?: string
  AUTH_HMAC_SECRET?: string
}

export type UserRole = 'owner' | 'lab-technician' | 'sample-collector'

type UserRow = {
  id: string
  username: string
  normalized_username: string
  password_hash: string | null
  role: UserRole
  lab_technician_id: string | null
  sample_collector_id: string | null
  is_active: number
  created_at: string
}

type SessionRow = {
  session_id: string
  user_id: string
  csrf_token_hash: string
  username: string
  role: UserRole
  lab_technician_id: string | null
  sample_collector_id: string | null
}

export type AuthenticatedUser = {
  id: string
  username: string
  role: UserRole
  labTechnicianId: string | null
  sampleCollectorId: string | null
}

type SessionTokens = {
  sessionToken: string
  csrfToken: string
}

const sessionCookieName = '__Host-prime_session'
const csrfCookieName = '__Host-prime_csrf'
const sessionLifetimeMs = 8 * 60 * 60 * 1000
const sessionIdleLifetimeMs = 30 * 60 * 1000
const loginRequestWindowMs = 15 * 60 * 1000
const usernameLoginLimit = 10
const ipLoginLimit = 50
const maximumRequestBytes = 2_048
const passwordHashIterations = 100_000
const dummyPasswordHash = `pbkdf2-sha256$${passwordHashIterations}$${'00'.repeat(16)}$${'00'.repeat(32)}`

export function jsonResponse(body: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const username = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._@-]{2,63}$/.test(username) ? username : null
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function readJson(
  request: Request,
  maximumBytes = maximumRequestBytes,
): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') return null

  const contentLengthHeader = request.headers.get('content-length')
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader)
    if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maximumBytes) {
      return null
    }
  }

  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > maximumBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function equalConstantTime(first: string, second: string): boolean {
  if (!first || !second || first.length !== second.length) return false
  let difference = 0
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index)
  }
  return difference === 0
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

async function hmac(env: AuthEnv, value: string): Promise<string> {
  if (!env.AUTH_HMAC_SECRET || env.AUTH_HMAC_SECRET.length < 32) {
    throw new Error('AUTH_HMAC_SECRET must contain at least 32 characters.')
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.AUTH_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(signature))
}

async function passwordHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const digest = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations: passwordHashIterations,
  }, key, 256)
  return `pbkdf2-sha256$${passwordHashIterations}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(digest))}`
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, iterationsValue, saltHex, hashHex] = storedHash.split('$')
  const iterations = Number(iterationsValue)
  if (
    algorithm !== 'pbkdf2-sha256' ||
    !Number.isInteger(iterations) || iterations !== passwordHashIterations ||
    !/^[a-f0-9]{32}$/i.test(saltHex ?? '') ||
    !/^[a-f0-9]{64}$/i.test(hashHex ?? '')
  ) {
    return false
  }
  const salt = Uint8Array.from(saltHex.match(/../g) ?? [], (byte) => Number.parseInt(byte, 16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const digest = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt,
    iterations,
  }, key, 256)
  return equalConstantTime(bytesToHex(new Uint8Array(digest)), hashHex.toLowerCase())
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=')
    if (separator < 0 || segment.slice(0, separator).trim() !== name) continue
    return segment.slice(separator + 1).trim() || null
  }
  return null
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${sessionCookieName}=${token}; Max-Age=${maxAgeSeconds}; Path=/; Secure; HttpOnly; SameSite=Strict`
}

function csrfCookie(token: string, maxAgeSeconds: number): string {
  return `${csrfCookieName}=${token}; Max-Age=${maxAgeSeconds}; Path=/; Secure; SameSite=Strict`
}

function clearSessionCookies(): string[] {
  return [
    sessionCookie('', 0),
    csrfCookie('', 0),
  ]
}

function toAuthenticatedUser(user: Pick<UserRow, 'id' | 'username' | 'role' | 'lab_technician_id' | 'sample_collector_id'>): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    labTechnicianId: user.lab_technician_id,
    sampleCollectorId: user.sample_collector_id,
  }
}

function newSessionTokens(): SessionTokens {
  return { sessionToken: randomToken(), csrfToken: randomToken() }
}

async function insertSession(
  env: AuthEnv,
  userId: string,
  tokens: SessionTokens,
  previousTokenHash?: string,
): Promise<boolean> {
  const now = new Date()
  const createdAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs).toISOString()
  const sessionId = crypto.randomUUID()
  const tokenHash = await sha256(tokens.sessionToken)
  const csrfTokenHash = await sha256(tokens.csrfToken)
  const statements = []
  if (previousTokenHash) {
    statements.push(env.DB.prepare(`
      UPDATE user_sessions SET revoked_at = ?
      WHERE token_hash = ? AND revoked_at IS NULL
    `).bind(createdAt, previousTokenHash))
  }
  statements.push(
    env.DB.prepare(`
      INSERT INTO user_sessions (
        id, user_id, token_hash, csrf_token_hash, created_at, last_seen_at, expires_at
      )
      SELECT ?, id, ?, ?, ?, ?, ?
      FROM users
      WHERE id = ? AND is_active = 1
    `).bind(sessionId, tokenHash, csrfTokenHash, createdAt, createdAt, expiresAt, userId),
    env.DB.prepare(`
      INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, created_at)
      SELECT ?, id, 'login', 'user', id, ?
      FROM users
      WHERE id = ? AND is_active = 1
        AND EXISTS (SELECT 1 FROM user_sessions WHERE id = ?)
    `).bind(crypto.randomUUID(), createdAt, userId, sessionId),
  )
  const results = await env.DB.batch(statements)
  const insertResult = results[previousTokenHash ? 1 : 0]
  return insertResult?.meta.changes === 1
}

async function findSession(request: Request, env: AuthEnv): Promise<SessionRow | null> {
  const token = getCookie(request, sessionCookieName)
  if (!token) return null
  const tokenHash = await sha256(token)
  const now = new Date()
  const nowIso = now.toISOString()
  const session = await env.DB.prepare(`
    SELECT
      sessions.id AS session_id,
      sessions.user_id,
      sessions.csrf_token_hash,
      users.username,
      users.role,
      users.lab_technician_id,
      users.sample_collector_id
    FROM user_sessions AS sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
      AND sessions.revoked_at IS NULL
      AND sessions.expires_at > ?
      AND sessions.last_seen_at > ?
      AND users.is_active = 1
  `).bind(
    tokenHash,
    nowIso,
    new Date(now.getTime() - sessionIdleLifetimeMs).toISOString(),
  ).first<SessionRow>()
  if (!session) return null

  const touched = await env.DB.prepare(`
    UPDATE user_sessions SET last_seen_at = ?
    WHERE id = ? AND revoked_at IS NULL AND expires_at > ? AND last_seen_at > ?
  `).bind(
    nowIso,
    session.session_id,
    nowIso,
    new Date(now.getTime() - sessionIdleLifetimeMs).toISOString(),
  ).run()
  return touched.meta.changes === 1 ? session : null
}

async function verifyCsrf(request: Request, session: SessionRow): Promise<boolean> {
  const cookieToken = getCookie(request, csrfCookieName)
  const headerToken = request.headers.get('x-csrf-token')
  if (!cookieToken || !headerToken || !equalConstantTime(cookieToken, headerToken)) return false
  return equalConstantTime(await sha256(cookieToken), session.csrf_token_hash)
}

async function csrfForSession(
  request: Request,
  env: AuthEnv,
  session: SessionRow,
): Promise<{ token: string; cookie?: string } | null> {
  const existingToken = getCookie(request, csrfCookieName)
  if (existingToken && equalConstantTime(await sha256(existingToken), session.csrf_token_hash)) {
    return { token: existingToken }
  }

  const token = randomToken()
  const updated = await env.DB.prepare(`
    UPDATE user_sessions SET csrf_token_hash = ?
    WHERE id = ? AND revoked_at IS NULL
  `).bind(await sha256(token), session.session_id).run()
  if (updated.meta.changes !== 1) return null
  return { token, cookie: csrfCookie(token, Math.floor(sessionLifetimeMs / 1000)) }
}

async function recordRequestLimit(
  env: AuthEnv,
  key: string,
  maximumRequests: number,
  now: string,
  windowStart: string,
): Promise<boolean> {
  const result = await env.DB.prepare(`
    INSERT INTO auth_login_request_limits (identifier_key_hash, request_count, window_started_at)
    VALUES (?, 1, ?)
    ON CONFLICT(identifier_key_hash) DO UPDATE SET
      request_count = CASE
        WHEN auth_login_request_limits.window_started_at <= ? THEN 1
        ELSE auth_login_request_limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN auth_login_request_limits.window_started_at <= ? THEN ?
        ELSE auth_login_request_limits.window_started_at
      END
    WHERE auth_login_request_limits.window_started_at <= ?
       OR auth_login_request_limits.request_count < ?
    RETURNING request_count
  `).bind(key, now, windowStart, windowStart, now, windowStart, maximumRequests)
    .first<{ request_count: number }>()
  return result !== null
}

async function login(request: Request, env: AuthEnv): Promise<Response> {
  const usernameRateLimitSecret = env.AUTH_HMAC_SECRET
  if (!usernameRateLimitSecret || usernameRateLimitSecret.length < 32) {
    return jsonResponse({ error: 'Authentication is not configured.' }, 503)
  }
  const body = await readJson(request)
  const username = normalizeUsername(body?.username)
  const password = body?.password
  if (!username || !isValidPassword(password)) {
    return jsonResponse({ error: 'Enter a valid username and password.' }, 400)
  }

  const nowDate = new Date()
  const now = nowDate.toISOString()
  const windowStart = new Date(nowDate.getTime() - loginRequestWindowMs).toISOString()
  const clientIp = request.headers.get('cf-connecting-ip')
  const usernameKey = await hmac(env, `login:username:${username}`)
  const usernameAllowed = await recordRequestLimit(
    env,
    usernameKey,
    usernameLoginLimit,
    now,
    windowStart,
  )
  const ipAllowed = !clientIp || await recordRequestLimit(
    env,
    await hmac(env, `login:ip:${clientIp}`),
    ipLoginLimit,
    now,
    windowStart,
  )
  if (!usernameAllowed || !ipAllowed) {
    return jsonResponse({ error: 'Invalid username or password.' }, 401)
  }

  const user = await env.DB.prepare(`
    SELECT id, username, normalized_username, password_hash, role,
           lab_technician_id, sample_collector_id, is_active, created_at
    FROM users
    WHERE normalized_username = ? AND is_active = 1
  `).bind(username).first<UserRow>()
  const passwordMatches = await verifyPassword(password, user?.password_hash ?? dummyPasswordHash)
  if (!user || !passwordMatches) {
    if (user) {
      await env.DB.prepare(`
        INSERT INTO audit_events (id, action, entity_type, entity_id, created_at)
        VALUES (?, 'login_failure', 'user', ?, ?)
      `).bind(crypto.randomUUID(), user.id, now).run()
    }
    return jsonResponse({ error: 'Invalid username or password.' }, 401)
  }

  const tokens = newSessionTokens()
  const previousToken = getCookie(request, sessionCookieName)
  const previousTokenHash = previousToken ? await sha256(previousToken) : undefined
  if (!await insertSession(env, user.id, tokens, previousTokenHash)) {
    return jsonResponse({ error: 'This account is no longer active.' }, 401)
  }
  await env.DB.prepare(`
    DELETE FROM auth_login_request_limits WHERE identifier_key_hash = ?
  `).bind(usernameKey).run()
  const maxAge = Math.floor(sessionLifetimeMs / 1000)
  return jsonResponse(
    { user: toAuthenticatedUser(user), csrfToken: tokens.csrfToken },
    200,
    [sessionCookie(tokens.sessionToken, maxAge), csrfCookie(tokens.csrfToken, maxAge)],
  )
}

async function bootstrapOwner(request: Request, env: AuthEnv): Promise<Response> {
  const expectedToken = env.BOOTSTRAP_TOKEN
  const providedToken = request.headers.get('x-bootstrap-token') ?? ''
  if (!expectedToken || expectedToken.length < 32) {
    return jsonResponse({ error: 'Owner bootstrap is not enabled.' }, 503)
  }
  if (!equalConstantTime(providedToken, expectedToken)) {
    return jsonResponse({ error: 'Not authorized.' }, 401)
  }

  const body = await readJson(request)
  const username = normalizeUsername(body?.username)
  const password = body?.password
  if (!username || !isValidPassword(password)) {
    return jsonResponse({ error: 'Enter a valid owner username and password of at least 12 characters.' }, 400)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const storedPasswordHash = await passwordHash(password)
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (
        id, username, normalized_username, password_hash, role, is_active, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, 'owner', 1, ?, ?
      WHERE EXISTS (SELECT 1 FROM bootstrap_state WHERE id = 1 AND consumed_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM users)
    `).bind(id, username, username, storedPasswordHash, now, now),
    env.DB.prepare(`
      UPDATE bootstrap_state SET consumed_at = ?
      WHERE id = 1 AND consumed_at IS NULL
        AND EXISTS (SELECT 1 FROM users WHERE id = ?)
    `).bind(now, id),
    env.DB.prepare(`
      INSERT INTO audit_events (id, action, entity_type, entity_id, created_at)
      SELECT ?, 'owner_bootstrap', 'user', ?, ?
      WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
    `).bind(crypto.randomUUID(), id, now, id),
  ])
  if (results[0]?.meta.changes !== 1) {
    return jsonResponse({ error: 'Owner bootstrap is already complete.' }, 409)
  }
  return jsonResponse({ user: { id, username, role: 'owner' } }, 201)
}

async function getAuthenticatedContext(
  request: Request,
  env: AuthEnv,
): Promise<{ session: SessionRow; user: AuthenticatedUser } | null> {
  const session = await findSession(request, env)
  return session ? { session, user: toAuthenticatedUser({
    id: session.user_id,
    username: session.username,
    role: session.role,
    lab_technician_id: session.lab_technician_id,
    sample_collector_id: session.sample_collector_id,
  }) } : null
}

export async function authorizeRequest(
  request: Request,
  env: AuthEnv,
  allowedRoles: readonly UserRole[],
): Promise<{ user: AuthenticatedUser } | { response: Response }> {
  const context = await getAuthenticatedContext(request, env)
  if (!context) {
    return { response: jsonResponse({ error: 'Authentication required.' }, 401, clearSessionCookies()) }
  }
  if (!allowedRoles.includes(context.user.role)) {
    return { response: jsonResponse({ error: 'Forbidden.' }, 403) }
  }
  if (request.method !== 'GET' && !await verifyCsrf(request, context.session)) {
    return { response: jsonResponse({ error: 'Invalid CSRF token.' }, 403) }
  }
  return { user: context.user }
}

async function currentUser(request: Request, env: AuthEnv): Promise<Response> {
  const context = await getAuthenticatedContext(request, env)
  if (!context) return jsonResponse({ error: 'Authentication required.' }, 401, clearSessionCookies())
  const csrf = await csrfForSession(request, env, context.session)
  if (!csrf) return jsonResponse({ error: 'Session expired. Sign in again.' }, 401, clearSessionCookies())
  return jsonResponse(
    { user: context.user, csrfToken: csrf.token },
    200,
    csrf.cookie ? [csrf.cookie] : [],
  )
}

async function logout(request: Request, env: AuthEnv): Promise<Response> {
  const context = await getAuthenticatedContext(request, env)
  if (!context) return jsonResponse({ error: 'Authentication required.' }, 401, clearSessionCookies())
  if (!await verifyCsrf(request, context.session)) {
    return jsonResponse({ error: 'Invalid CSRF token.' }, 403)
  }

  await env.DB.prepare(`
    UPDATE user_sessions SET revoked_at = ?
    WHERE id = ? AND revoked_at IS NULL
  `).bind(new Date().toISOString(), context.session.session_id).run()
  return jsonResponse({ status: 'signed-out' }, 200, clearSessionCookies())
}

async function requireOwner(
  request: Request,
  env: AuthEnv,
): Promise<{ user: AuthenticatedUser } | { response: Response }> {
  return authorizeRequest(request, env, ['owner'])
}

async function listUsers(request: Request, env: AuthEnv): Promise<Response> {
  const authorization = await requireOwner(request, env)
  if ('response' in authorization) return authorization.response
  const users = await env.DB.prepare(`
    SELECT id, username, role, lab_technician_id, sample_collector_id, is_active, created_at
    FROM users
    ORDER BY created_at, username
  `).all<Pick<UserRow,
    'id' | 'username' | 'role' | 'lab_technician_id' | 'sample_collector_id' | 'is_active' | 'created_at'
  >>()
  return jsonResponse({ users: users.results.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    labTechnicianId: user.lab_technician_id,
    sampleCollectorId: user.sample_collector_id,
    isActive: user.is_active === 1,
    createdAt: user.created_at,
  })) })
}

async function provisionUser(request: Request, env: AuthEnv): Promise<Response> {
  const authorization = await requireOwner(request, env)
  if ('response' in authorization) return authorization.response
  const body = await readJson(request)
  const username = normalizeUsername(body?.username)
  const password = body?.password
  const role = body?.role
  const labTechnicianId = typeof body?.labTechnicianId === 'string' ? body.labTechnicianId.trim() || null : null
  const sampleCollectorId = typeof body?.sampleCollectorId === 'string' ? body.sampleCollectorId.trim() || null : null
  if (!username || !isValidPassword(password) ||
    (role !== 'owner' && role !== 'lab-technician' && role !== 'sample-collector')) {
    return jsonResponse({ error: 'Enter a valid username, password of at least 12 characters, and role.' }, 400)
  }
  if (role === 'lab-technician' && !labTechnicianId) {
    return jsonResponse({ error: 'Select the lab technician for this account.' }, 400)
  }
  if (role === 'sample-collector' && !sampleCollectorId) {
    return jsonResponse({ error: 'Select the sample collector for this account.' }, 400)
  }
  if (role !== 'lab-technician' && labTechnicianId) {
    return jsonResponse({ error: 'A technician association is only valid for a lab technician account.' }, 400)
  }
  if (role !== 'sample-collector' && sampleCollectorId) {
    return jsonResponse({ error: 'A collector association is only valid for a sample collector account.' }, 400)
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE normalized_username = ?')
    .bind(username).first<{ id: string }>()
  if (existing) return jsonResponse({ error: 'An account already exists for this username.' }, 409)

  if (labTechnicianId) {
    const technician = await env.DB.prepare(`
      SELECT id FROM lab_technicians WHERE id = ? AND archived_at IS NULL
    `).bind(labTechnicianId).first()
    if (!technician) return jsonResponse({ error: 'The selected lab technician is unavailable.' }, 400)
  }
  if (sampleCollectorId) {
    const collector = await env.DB.prepare(`
      SELECT id FROM sample_collectors WHERE id = ? AND archived_at IS NULL
    `).bind(sampleCollectorId).first()
    if (!collector) return jsonResponse({ error: 'The selected sample collector is unavailable.' }, 400)
  }

  const userId = crypto.randomUUID()
  const now = new Date().toISOString()
  const storedPasswordHash = await passwordHash(password)
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO users (
          id, username, normalized_username, password_hash, role, lab_technician_id,
          sample_collector_id, is_active, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).bind(
        userId,
        username,
        username,
        storedPasswordHash,
        role,
        labTechnicianId,
        sampleCollectorId,
        authorization.user.id,
        now,
        now,
      ),
      env.DB.prepare(`
        INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, created_at)
        VALUES (?, ?, 'user_provisioned', 'user', ?, ?)
      `).bind(crypto.randomUUID(), authorization.user.id, userId, now),
    ])
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: users.normalized_username')) {
      return jsonResponse({ error: 'An account already exists for this username.' }, 409)
    }
    console.error('Unable to provision an account.', error)
    return jsonResponse({ error: 'Unable to provision this account.' }, 500)
  }
  return jsonResponse({ user: { id: userId, username, role } }, 201)
}

async function disableUser(request: Request, env: AuthEnv, userId: string): Promise<Response> {
  const authorization = await requireOwner(request, env)
  if ('response' in authorization) return authorization.response
  if (authorization.user.id === userId) {
    return jsonResponse({ error: 'You cannot disable your own account.' }, 409)
  }

  const target = await env.DB.prepare(`
    SELECT id, role, is_active FROM users WHERE id = ?
  `).bind(userId).first<{ id: string; role: UserRole; is_active: number }>()
  if (!target || target.is_active !== 1) return jsonResponse({ error: 'Account not found.' }, 404)
  if (target.role === 'owner') {
    const owners = await env.DB.prepare(`
      SELECT COUNT(*) AS count FROM users WHERE role = 'owner' AND is_active = 1
    `).first<{ count: number }>()
    if ((owners?.count ?? 0) <= 1) {
      return jsonResponse({ error: 'The last active owner account cannot be disabled.' }, 409)
    }
  }

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ? AND is_active = 1')
      .bind(now, userId),
    env.DB.prepare(`
      UPDATE user_sessions SET revoked_at = ?
      WHERE user_id = ? AND revoked_at IS NULL
    `).bind(now, userId),
    env.DB.prepare(`
      INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (?, ?, 'user_disabled', 'user', ?, ?)
    `).bind(crypto.randomUUID(), authorization.user.id, userId, now),
  ])
  return jsonResponse({ status: 'disabled' })
}

export async function handleAuthRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url)
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return login(request, env)
  if (url.pathname === '/api/auth/bootstrap' && request.method === 'POST') return bootstrapOwner(request, env)
  if (url.pathname === '/api/auth/me' && request.method === 'GET') return currentUser(request, env)
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') return logout(request, env)
  if (url.pathname === '/api/auth/users' && request.method === 'GET') return listUsers(request, env)
  if (url.pathname === '/api/auth/users' && request.method === 'POST') return provisionUser(request, env)
  const disableUserMatch = url.pathname.match(/^\/api\/auth\/users\/([^/]+)$/)
  if (disableUserMatch && request.method === 'DELETE') {
    let userId: string
    try {
      userId = decodeURIComponent(disableUserMatch[1])
    } catch {
      return jsonResponse({ error: 'Invalid account id.' }, 400)
    }
    return disableUser(request, env, userId)
  }
  return null
}
