import {
  authorizeRequest,
  jsonResponse,
  readJson,
  type AuthEnv,
  type AuthenticatedUser,
  type UserRole,
} from './auth'

type MasterTable = 'lab_technicians' | 'referrers' | 'sample_collectors' | 'tests'
type MasterResource = 'lab-technicians' | 'referrers' | 'sample-collectors' | 'tests'

type ParameterInput = {
  name: string
  unit: string
  reference: string
  groupId: string | null
  groupName: string | null
}

type MasterTestInput = {
  name: string
  category: string
  pricePaise: number
  profiles: ('preoperative' | 'anc')[]
  parameters: ParameterInput[]
  reagents: { itemId: string; quantityHundredths: number }[]
}

const allRoles: readonly UserRole[] = ['owner', 'lab-technician', 'sample-collector']
const managerRoles: readonly UserRole[] = ['owner', 'lab-technician']

function isManager(user: AuthenticatedUser): boolean {
  return user.role === 'owner' || user.role === 'lab-technician'
}

function resourceTable(resource: MasterResource): MasterTable {
  if (resource === 'lab-technicians') return 'lab_technicians'
  if (resource === 'sample-collectors') return 'sample_collectors'
  return resource
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

function readText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length > 0 && text.length <= maximumLength ? text : null
}

function readOptionalText(value: unknown, maximumLength: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!text) return null
  return text.length <= maximumLength ? text : undefined
}

async function listMasters(env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const [technicians, referrers, collectors] = await Promise.all([
    isManager(user)
      ? env.DB.prepare(`
        SELECT id, name, specialty, phone FROM lab_technicians
        WHERE archived_at IS NULL ORDER BY name, id
      `).all<{ id: string; name: string; specialty: string; phone: string }>()
      : Promise.resolve({ results: [] as { id: string; name: string; specialty: string; phone: string }[] }),
    env.DB.prepare(`
      SELECT id, name, organization, phone FROM referrers
      WHERE archived_at IS NULL ORDER BY name, id
    `).all<{ id: string; name: string; organization: string; phone: string }>(),
    user.role === 'sample-collector' && user.sampleCollectorId
      ? env.DB.prepare(`
        SELECT id, name, phone FROM sample_collectors
        WHERE id = ? AND archived_at IS NULL
      `).bind(user.sampleCollectorId).all<{ id: string; name: string; phone: string }>()
      : isManager(user)
        ? env.DB.prepare(`
          SELECT id, name, phone FROM sample_collectors
          WHERE archived_at IS NULL ORDER BY name, id
        `).all<{ id: string; name: string; phone: string }>()
        : Promise.resolve({ results: [] as { id: string; name: string; phone: string }[] }),
  ])
  return jsonResponse({
    labTechnicians: technicians.results,
    referrers: referrers.results,
    sampleCollectors: collectors.results,
  })
}

async function createContactMaster(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  table: 'lab_technicians' | 'referrers' | 'sample_collectors',
): Promise<Response> {
  const body = await readJson(request)
  const name = readText(body?.name, 120)
  const phoneValue = body?.phone === undefined ? '' : readOptionalText(body.phone, 40)
  if (!name || phoneValue === undefined) {
    return jsonResponse({ error: 'Enter valid master record details.' }, 400)
  }
  const phone = phoneValue ?? ''

  const specialty = table === 'lab_technicians' ? readText(body?.specialty, 120) : ''
  const organization = table === 'referrers' ? readText(body?.organization, 160) : ''
  if ((table === 'lab_technicians' && !specialty) || (table === 'referrers' && !organization)) {
    return jsonResponse({ error: 'Enter the required specialty or organization.' }, 400)
  }

  const id = `${table === 'lab_technicians' ? 'tech' : table === 'sample_collectors' ? 'collector' : 'ref'}-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const insert = table === 'lab_technicians'
    ? env.DB.prepare(`
      INSERT INTO lab_technicians (id, name, specialty, phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, name, specialty, phone, now, now)
    : table === 'referrers'
      ? env.DB.prepare(`
        INSERT INTO referrers (id, name, organization, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, name, organization, phone, now, now)
      : env.DB.prepare(`
        INSERT INTO sample_collectors (id, name, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, name, phone, now, now)

  await env.DB.batch([
    insert,
    env.DB.prepare(`
      INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (?, ?, 'master_created', ?, ?, ?)
    `).bind(crypto.randomUUID(), user.id, table, id, now),
  ])
  return jsonResponse({ record: { id, name, ...(table === 'lab_technicians' ? { specialty } : {}), ...(table === 'referrers' ? { organization } : {}), phone } }, 201)
}

function parsePrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  const pricePaise = Math.round(value * 100)
  return Number.isSafeInteger(pricePaise) &&
    pricePaise <= Number.MAX_SAFE_INTEGER &&
    Math.abs(value * 100 - pricePaise) < 1e-7
    ? pricePaise
    : null
}

function parseMasterTest(body: Record<string, unknown> | null, testId: string): MasterTestInput | null {
  if (!body) return null
  const name = readText(body.name, 120)
  const category = readText(body.category, 80)
  const pricePaise = parsePrice(body.price)
  if (!name || !category || pricePaise === null) return null

  const profilesValue = body.profiles ?? []
  if (!Array.isArray(profilesValue)) return null
  if (
    profilesValue.some((profile) => profile !== 'preoperative' && profile !== 'anc' && profile !== 'other') ||
    new Set(profilesValue).size !== profilesValue.length ||
    (profilesValue.includes('other') && profilesValue.length > 1)
  ) {
    return null
  }
  const profiles = profilesValue.filter((profile): profile is 'preoperative' | 'anc' =>
    profile === 'preoperative' || profile === 'anc',
  )

  const groupsValue = body.parameterGroups
  if (!Array.isArray(groupsValue) || groupsValue.length < 1 || groupsValue.length > 50) return null
  const parameters: ParameterInput[] = []
  for (const [groupIndex, groupValue] of groupsValue.entries()) {
    if (typeof groupValue !== 'object' || groupValue === null || Array.isArray(groupValue)) return null
    const group = groupValue as Record<string, unknown>
    const rawGroupName = readOptionalText(group.name, 80)
    if (rawGroupName === undefined) return null
    const groupName = rawGroupName || null
    if (!Array.isArray(group.parameters) || group.parameters.length < 1) return null
    for (const parameterValue of group.parameters) {
      if (typeof parameterValue !== 'object' || parameterValue === null || Array.isArray(parameterValue)) return null
      const parameter = parameterValue as Record<string, unknown>
      const parameterName = readText(parameter.name, 120)
      const unit = parameter.unit === undefined ? '' : readOptionalText(parameter.unit, 40)
      const reference = parameter.reference === undefined ? '' : readOptionalText(parameter.reference, 120)
      if (!parameterName || unit === undefined || reference === undefined) return null
      parameters.push({
        name: parameterName,
        unit: unit ?? '',
        reference: reference ?? '',
        groupId: groupName ? `${testId}-group-${groupIndex + 1}` : null,
        groupName,
      })
      if (parameters.length > 100) return null
    }
  }

  const reagentsValue = body.reagents ?? []
  if (!Array.isArray(reagentsValue) || reagentsValue.length > 50) return null
  const reagentQuantities = new Map<string, number>()
  for (const reagentValue of reagentsValue) {
    if (typeof reagentValue !== 'object' || reagentValue === null || Array.isArray(reagentValue)) return null
    const reagent = reagentValue as Record<string, unknown>
    const itemId = readText(reagent.itemId, 128)
    const quantity = reagent.quantity
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return null
    const quantityHundredths = Math.round(quantity * 100)
    if (
      !itemId ||
      !Number.isSafeInteger(quantityHundredths) ||
      quantityHundredths < 1 ||
      Math.abs(quantity * 100 - quantityHundredths) >= 1e-7
    ) {
      return null
    }
    const total = (reagentQuantities.get(itemId) ?? 0) + quantityHundredths
    if (!Number.isSafeInteger(total)) return null
    reagentQuantities.set(itemId, total)
  }

  return {
    name,
    category,
    pricePaise,
    profiles,
    parameters,
    reagents: Array.from(reagentQuantities, ([itemId, quantityHundredths]) => ({
      itemId,
      quantityHundredths,
    })),
  }
}

async function createTest(request: Request, env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const testId = `test-${crypto.randomUUID()}`
  const input = parseMasterTest(await readJson(request, 16_384), testId)
  if (!input) {
    return jsonResponse({ error: 'Enter valid test details, parameters, profiles, and reagent quantities.' }, 400)
  }

  if (input.reagents.length) {
    const placeholders = input.reagents.map(() => '?').join(', ')
    const materials = await env.DB.prepare(`
      SELECT id FROM inventory_items
      WHERE archived_at IS NULL AND category = 'material' AND id IN (${placeholders})
    `).bind(...input.reagents.map((reagent) => reagent.itemId)).all<{ id: string }>()
    if (materials.results.length !== input.reagents.length) {
      return jsonResponse({ error: 'Select active material inventory items for the test reagents.' }, 400)
    }
  }

  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(`
      INSERT INTO tests (id, name, category, price_paise, unit, reference, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', '', ?, ?)
    `).bind(testId, input.name, input.category, input.pricePaise, now, now),
  ]
  for (const profile of input.profiles) {
    statements.push(env.DB.prepare(`
      INSERT INTO test_profile_tests (profile_id, test_id, sort_order)
      VALUES (?, ?, 0)
    `).bind(profile, testId))
  }
  for (const [index, parameter] of input.parameters.entries()) {
    statements.push(env.DB.prepare(`
      INSERT INTO test_parameters (
        id, test_id, name, unit, reference, group_id, group_name,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `${testId}-parameter-${index + 1}`,
      testId,
      parameter.name,
      parameter.unit,
      parameter.reference,
      parameter.groupId,
      parameter.groupName,
      index,
      now,
      now,
    ))
  }
  for (const reagent of input.reagents) {
    statements.push(env.DB.prepare(`
      INSERT INTO test_reagents (test_id, item_id, quantity_hundredths)
      VALUES (?, ?, ?)
    `).bind(testId, reagent.itemId, reagent.quantityHundredths))
  }
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'test_created', 'test', ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    testId,
    JSON.stringify({ parameterCount: input.parameters.length, profileCount: input.profiles.length, reagentCount: input.reagents.length }),
    now,
  ))
  await env.DB.batch(statements)
  return jsonResponse({
    test: {
      id: testId,
      name: input.name,
      category: input.category,
      price: input.pricePaise / 100,
      profiles: input.profiles.length ? input.profiles : ['other'],
      parameters: input.parameters,
      reagents: input.reagents.map((reagent) => ({
        itemId: reagent.itemId,
        quantity: reagent.quantityHundredths / 100,
      })),
    },
  }, 201)
}

async function archiveMaster(
  env: AuthEnv,
  user: AuthenticatedUser,
  table: MasterTable,
  id: string,
): Promise<Response> {
  const now = new Date().toISOString()
  const update = table === 'lab_technicians'
    ? env.DB.prepare(`
      UPDATE lab_technicians SET archived_at = ?, updated_at = ?
      WHERE id = ? AND archived_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM users WHERE lab_technician_id = ? AND is_active = 1)
    `).bind(now, now, id, id)
    : table === 'sample_collectors'
      ? env.DB.prepare(`
        UPDATE sample_collectors SET archived_at = ?, updated_at = ?
        WHERE id = ? AND archived_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM users WHERE sample_collector_id = ? AND is_active = 1)
      `).bind(now, now, id, id)
      : table === 'referrers'
        ? env.DB.prepare('UPDATE referrers SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL')
          .bind(now, now, id)
        : env.DB.prepare('UPDATE tests SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL')
          .bind(now, now, id)
  const results = await env.DB.batch([
    update,
    env.DB.prepare(`
      INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, created_at)
      SELECT ?, ?, 'master_archived', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND archived_at = ?)
    `).bind(crypto.randomUUID(), user.id, table, id, now, id, now),
  ])
  if (results[0]?.meta.changes !== 1) {
    const existing = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(id).first()
    if (!existing) return jsonResponse({ error: 'Master record not found.' }, 404)
    if (table === 'lab_technicians' || table === 'sample_collectors') {
      return jsonResponse({ error: 'Disable or reassign active accounts before archiving this record.' }, 409)
    }
    return jsonResponse({ error: 'Master record is already archived.' }, 409)
  }
  return jsonResponse({ status: 'archived' })
}

export async function handleMasterRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const masterPath = url.pathname === '/api/masters'
  const collectionMatch = url.pathname.match(/^\/api\/masters\/(lab-technicians|referrers|sample-collectors|tests)$/)
  const archiveMatch = url.pathname.match(/^\/api\/masters\/(lab-technicians|referrers|sample-collectors|tests)\/([^/]+)$/)
  if (!masterPath && !collectionMatch && !archiveMatch) return null
  if ((masterPath && request.method !== 'GET') || (collectionMatch && request.method !== 'POST') || (archiveMatch && request.method !== 'DELETE')) {
    return methodNotAllowed(masterPath ? 'GET' : collectionMatch ? 'POST' : 'DELETE')
  }

  try {
    if (masterPath) {
      const authorization = await authorizeRequest(request, env, allRoles)
      if ('response' in authorization) return authorization.response
      return await listMasters(env, authorization.user)
    }
    if (collectionMatch) {
      const authorization = await authorizeRequest(request, env, managerRoles)
      if ('response' in authorization) return authorization.response
      const table = resourceTable(collectionMatch[1] as MasterResource)
      if (table === 'tests') return await createTest(request, env, authorization.user)
      return await createContactMaster(request, env, authorization.user, table)
    }

    const authorization = await authorizeRequest(request, env, managerRoles)
    if ('response' in authorization) return authorization.response
    let id: string
    try {
      id = decodeURIComponent(archiveMatch![2])
    } catch {
      return jsonResponse({ error: 'Invalid master record id.' }, 400)
    }
    return await archiveMaster(env, authorization.user, resourceTable(archiveMatch![1] as MasterResource), id)
  } catch (error) {
    console.error('Unable to process a master API request.', error)
    return jsonResponse({ error: 'Unable to process this request.' }, 500)
  }
}
