import {
  authorizeRequest,
  jsonResponse,
  readJson,
  type AuthEnv,
  type AuthenticatedUser,
  type UserRole,
} from './auth'

type AssetKind = 'logo' | 'signature' | 'payment-qr'
type LabSettingsRow = {
  name: string
  address: string
  owner_name: string
  mobile: string
  logo_object_key: string | null
  signature_object_key: string | null
  payment_qr_object_key: string | null
  updated_at: string
}

const managerRoles: readonly UserRole[] = ['owner', 'lab-technician']
const ownerRoles: readonly UserRole[] = ['owner']
const assetColumns: Record<AssetKind, keyof Pick<
  LabSettingsRow,
  'logo_object_key' | 'signature_object_key' | 'payment_qr_object_key'
>> = {
  logo: 'logo_object_key',
  signature: 'signature_object_key',
  'payment-qr': 'payment_qr_object_key',
}
const imageTypes: Record<AssetKind, ReadonlySet<string>> = {
  logo: new Set(['image/png', 'image/jpeg']),
  signature: new Set(['image/png', 'image/jpeg']),
  'payment-qr': new Set(['image/png', 'image/jpeg', 'image/webp']),
}
const imageSizeLimits: Record<AssetKind, number> = {
  logo: 512 * 1024,
  signature: 512 * 1024,
  'payment-qr': 4 * 1024 * 1024,
}

function isAssetKind(value: string): value is AssetKind {
  return value === 'logo' || value === 'signature' || value === 'payment-qr'
}

function methodNotAllowed(allow: string): Response {
  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      allow,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function getSettingsRow(env: AuthEnv): Promise<LabSettingsRow | null> {
  return env.DB.prepare(`
    SELECT name, address, owner_name, mobile, logo_object_key, signature_object_key,
      payment_qr_object_key, updated_at
    FROM lab_settings WHERE id = 1
  `).first<LabSettingsRow>()
}

function settingsResponse(row: LabSettingsRow | null) {
  const updatedAt = row?.updated_at ?? ''
  const assetUrl = (available: boolean, kind: AssetKind) =>
    available ? `/api/lab/assets/${kind}?v=${encodeURIComponent(updatedAt)}` : ''
  return {
    settings: {
      name: row?.name ?? '',
      address: row?.address ?? '',
      ownerName: row?.owner_name ?? '',
      mobile: row?.mobile ?? '',
      logoUrl: assetUrl(Boolean(row?.logo_object_key), 'logo'),
      signatureUrl: assetUrl(Boolean(row?.signature_object_key), 'signature'),
      paymentQrUrl: assetUrl(Boolean(row?.payment_qr_object_key), 'payment-qr'),
    },
  }
}

function keyForAsset(row: LabSettingsRow | null, kind: AssetKind): string | null {
  if (!row) return null
  const key = row[assetColumns[kind]]
  return typeof key === 'string' && key ? key : null
}

async function listSettings(env: AuthEnv): Promise<Response> {
  return jsonResponse(settingsResponse(await getSettingsRow(env)))
}

async function saveSettings(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
): Promise<Response> {
  const body = await readJson(request, 8_192)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const address = typeof body?.address === 'string' ? body.address.trim() : ''
  const ownerName = typeof body?.ownerName === 'string' ? body.ownerName.trim() : ''
  const mobile = typeof body?.mobile === 'string' ? body.mobile.trim() : ''
  if (
    !name || name.length > 120 || !address || address.length > 500 ||
    !ownerName || ownerName.length > 120 || !mobile || mobile.length > 40
  ) {
    return jsonResponse({ error: 'Enter a valid lab name, address, owner name, and mobile number.' }, 400)
  }

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO lab_settings (
        id, name, address, owner_name, mobile, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        address = excluded.address,
        owner_name = excluded.owner_name,
        mobile = excluded.mobile,
        updated_at = excluded.updated_at
    `).bind(name, address, ownerName, mobile, now, now),
    env.DB.prepare(`
      INSERT INTO audit_events (
        id, actor_user_id, action, entity_type, entity_id, details_json, created_at
      ) VALUES (?, ?, 'lab_settings_updated', 'lab_settings', '1', ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      JSON.stringify({ changedFields: ['name', 'address', 'ownerName', 'mobile'] }),
      now,
    ),
  ])
  return jsonResponse(settingsResponse(await getSettingsRow(env)))
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
}

function imageMatchesContentType(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/png') return hasPngSignature(bytes)
  if (contentType === 'image/jpeg') return hasJpegSignature(bytes)
  if (contentType === 'image/webp') return hasWebpSignature(bytes)
  return false
}

async function uploadAsset(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  kind: AssetKind,
): Promise<Response> {
  const bucket = env.ASSETS
  if (!bucket) return jsonResponse({ error: 'Private asset storage is not configured.' }, 503)
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null && Number(contentLength) > imageSizeLimits[kind] + 65_536) {
    return jsonResponse({ error: 'The uploaded image is too large.' }, 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonResponse({ error: 'Upload a valid image file.' }, 400)
  }
  const fields = [...form.keys()]
  const file = form.get('file')
  if (fields.length !== 1 || fields[0] !== 'file' || !(file instanceof File)) {
    return jsonResponse({ error: 'Upload exactly one image file.' }, 400)
  }
  if (
    file.size < 1 || file.size > imageSizeLimits[kind] ||
    !imageTypes[kind].has(file.type)
  ) {
    return jsonResponse({ error: 'Choose a supported image within the size limit.' }, 400)
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!imageMatchesContentType(bytes, file.type)) {
    return jsonResponse({ error: 'The uploaded file does not match its image type.' }, 400)
  }

  const currentRow = await getSettingsRow(env)
  const previousKey = keyForAsset(currentRow, kind)
  const objectKey = `lab-assets/${kind}/${crypto.randomUUID()}`
  await bucket.put(objectKey, bytes, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'private, no-store',
    },
  })

  const now = new Date().toISOString()
  const column = assetColumns[kind]
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO lab_settings (id, ${column}, created_at, updated_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          ${column} = excluded.${column},
          updated_at = excluded.updated_at
      `).bind(objectKey, now, now),
      env.DB.prepare(`
        INSERT INTO audit_events (
          id, actor_user_id, action, entity_type, entity_id, details_json, created_at
        ) VALUES (?, ?, 'lab_asset_uploaded', 'lab_asset', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.id,
        kind,
        JSON.stringify({ contentType: file.type, size: file.size }),
        now,
      ),
    ])
  } catch (error) {
    try {
      await bucket.delete(objectKey)
    } catch (cleanupError) {
      console.error('Unable to remove an unreferenced lab asset after a database error.', cleanupError)
    }
    throw error
  }

  const savedRow = await getSettingsRow(env)
  const savedKey = keyForAsset(savedRow, kind)
  const keyToDelete = savedKey === objectKey ? previousKey : objectKey
  if (keyToDelete) {
    try {
      await bucket.delete(keyToDelete)
    } catch (error) {
      console.error('Unable to remove an unreferenced lab asset from private storage.', error)
    }
  }
  return jsonResponse(settingsResponse(savedRow))
}

async function deleteAsset(
  env: AuthEnv,
  user: AuthenticatedUser,
  kind: AssetKind,
): Promise<Response> {
  const bucket = env.ASSETS
  if (!bucket) return jsonResponse({ error: 'Private asset storage is not configured.' }, 503)
  const currentRow = await getSettingsRow(env)
  const previousKey = keyForAsset(currentRow, kind)
  if (previousKey) {
    const now = new Date().toISOString()
    const column = assetColumns[kind]
    const results = await env.DB.batch([
      env.DB.prepare(`
        UPDATE lab_settings SET ${column} = NULL, updated_at = ?
        WHERE id = 1 AND ${column} = ?
      `).bind(now, previousKey),
      env.DB.prepare(`
        INSERT INTO audit_events (
          id, actor_user_id, action, entity_type, entity_id, created_at
        )
        SELECT ?, ?, 'lab_asset_deleted', 'lab_asset', ?, ?
        WHERE EXISTS (
          SELECT 1 FROM lab_settings
          WHERE id = 1 AND ${column} IS NULL AND updated_at = ?
        )
      `).bind(crypto.randomUUID(), user.id, kind, now, now),
    ])
    if (results[0]?.meta.changes !== 1) {
      return jsonResponse(settingsResponse(await getSettingsRow(env)))
    }
    if (keyForAsset(await getSettingsRow(env), kind) !== null) {
      return jsonResponse(settingsResponse(await getSettingsRow(env)))
    }
    try {
      await bucket.delete(previousKey)
    } catch (error) {
      console.error('Unable to remove a deleted lab asset from private storage.', error)
    }
  }
  return jsonResponse(settingsResponse(await getSettingsRow(env)))
}

async function readAsset(env: AuthEnv, kind: AssetKind): Promise<Response> {
  const bucket = env.ASSETS
  if (!bucket) return jsonResponse({ error: 'Private asset storage is not configured.' }, 503)
  const key = keyForAsset(await getSettingsRow(env), kind)
  if (!key) return jsonResponse({ error: 'Lab asset not found.' }, 404)
  const object = await bucket.get(key)
  if (!object) {
    console.error(`Lab asset ${kind} references a missing private object.`)
    return jsonResponse({ error: 'Lab asset not found.' }, 404)
  }
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': "default-src 'none'; sandbox",
  })
  if (object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType)
  if (object.httpEtag) headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}

export async function handleLabSettingsRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const settingsPath = url.pathname === '/api/lab/settings'
  const assetMatch = url.pathname.match(/^\/api\/lab\/assets\/([^/]+)$/)
  if (!settingsPath && !assetMatch) return null

  let kind: AssetKind | null = null
  if (assetMatch) {
    if (!isAssetKind(assetMatch[1])) return jsonResponse({ error: 'Unknown lab asset.' }, 404)
    kind = assetMatch[1]
    if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'DELETE') {
      return methodNotAllowed('GET, POST, DELETE')
    }
  } else if (request.method !== 'GET' && request.method !== 'PUT') {
    return methodNotAllowed('GET, PUT')
  }

  try {
    if (request.method === 'GET') {
      const authorization = await authorizeRequest(request, env, managerRoles)
      if ('response' in authorization) return authorization.response
      return kind ? await readAsset(env, kind) : await listSettings(env)
    }

    const authorization = await authorizeRequest(request, env, ownerRoles)
    if ('response' in authorization) return authorization.response
    if (kind) {
      return request.method === 'POST'
        ? await uploadAsset(request, env, authorization.user, kind)
        : await deleteAsset(env, authorization.user, kind)
    }
    return await saveSettings(request, env, authorization.user)
  } catch (error) {
    console.error('Unable to process a lab settings API request.', error)
    return jsonResponse({ error: 'Unable to process this request.' }, 500)
  }
}
