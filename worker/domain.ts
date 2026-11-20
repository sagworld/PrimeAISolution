import {
  authorizeRequest,
  jsonResponse,
  readJson,
  type AuthEnv,
  type AuthenticatedUser,
  type UserRole,
} from './auth'
import { isIsoDate, localDateStartUtc, nextIsoDate } from './dateUtils'

type PatientRow = {
  id: string
  name: string
  age: number
  gender: string
  phone: string
  lab_technician_id: string | null
  sample_collector_id: string | null
  referrer_id: string | null
  created_by_sample_collector: number
  created_at: string
}

type TestRow = {
  id: string
  name: string
  category: string
  price_paise: number
  unit: string
  reference: string
}

type ParameterRow = {
  id: string
  test_id: string
  name: string
  unit: string
  reference: string
  group_id: string | null
  group_name: string | null
}

type TestProfileRow = {
  test_id: string
  profile_id: 'preoperative' | 'anc'
}

type ReagentRow = {
  test_id: string
  item_id: string
  quantity_hundredths: number
}

type OrderRow = {
  id: string
  patient_id: string
  patient_name: string
  patient_age: number
  patient_gender: string
  patient_phone: string
  test_id: string
  test_name: string
  test_category: string
  test_unit: string
  test_reference: string
  created_at: string
  result: string
  status: 'Pending' | 'Completed'
  reagents_deducted_at: string | null
  printed_at: string | null
}

type OrderTestParameterRow = {
  id: string
  test_id: string
  name: string
  unit: string
  reference: string
  group_id: string | null
  group_name: string | null
  sort_order: number
}

type OrderResultRow = {
  order_id: string
  parameter_id: string
  value: string
}

type AttendanceRecordRow = {
  technician_id: string
  technician_name: string
  technician_specialty: string
  attendance_date: string
  status: 'Present' | 'Absent' | 'Leave'
  updated_at: string
}

type InvoiceTestRow = {
  id: string
  name: string
  price_paise: number
}

type InvoiceRow = {
  id: string
  patient_id: string
  patient_name: string
  patient_phone: string
  discount_paise: number
  amount_paise: number
  status: 'Paid' | 'Unpaid'
  payment_method: '' | 'Cash' | 'Online'
  invoice_date: string
}

type InvoiceItemRow = {
  id: string
  invoice_id: string
  test_id: string | null
  test_name: string
  amount_paise: number
  sort_order: number
}

type OptionalId = { valid: true; value: string | null } | { valid: false }

const allRoles: readonly UserRole[] = ['owner', 'lab-technician', 'sample-collector']
const managerRoles: readonly UserRole[] = ['owner', 'lab-technician']
const ownerRoles: readonly UserRole[] = ['owner']
const validGenders = new Set(['Female', 'Male', 'Other', 'Prefer not to say'])
const attendanceStatuses = new Set(['Present', 'Absent', 'Leave'])

function optionalId(value: unknown): OptionalId {
  if (value === undefined || value === null || value === '') return { valid: true, value: null }
  if (typeof value !== 'string') return { valid: false }
  const id = value.trim()
  return id.length > 0 && id.length <= 128 ? { valid: true, value: id } : { valid: false }
}

async function activeReferenceExists(
  env: AuthEnv,
  table: 'lab_technicians' | 'sample_collectors' | 'referrers',
  id: string | null,
): Promise<boolean> {
  if (!id) return true
  return Boolean(await env.DB.prepare(
    `SELECT id FROM ${table} WHERE id = ? AND archived_at IS NULL`,
  ).bind(id).first())
}

function toPatient(row: PatientRow) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    phone: row.phone,
    labTechnicianId: row.lab_technician_id,
    sampleCollectorId: row.sample_collector_id,
    referrerId: row.referrer_id,
    createdBySampleCollector: row.created_by_sample_collector === 1,
    createdAt: row.created_at,
  }
}

function isManager(user: AuthenticatedUser): boolean {
  return user.role === 'owner' || user.role === 'lab-technician'
}

async function listPatients(request: Request, env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  const limitValue = url.searchParams.get('limit')
  const offsetValue = url.searchParams.get('offset')
  const limit = limitValue === null ? 50 : Number(limitValue)
  const offset = offsetValue === null ? 0 : Number(offsetValue)
  if (
    query.length > 100 ||
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isInteger(offset) || offset < 0 || offset > 10_000
  ) {
    return jsonResponse({ error: 'Invalid patient search or pagination parameters.' }, 400)
  }

  const rows = isManager(user)
    ? await env.DB.prepare(`
      SELECT id, name, age, gender, phone, lab_technician_id,
             sample_collector_id, referrer_id, created_by_sample_collector, created_at
      FROM patients
      WHERE archived_at IS NULL
        AND (? = '' OR instr(lower(name), lower(?)) > 0
          OR instr(lower(phone), lower(?)) > 0 OR instr(lower(id), lower(?)) > 0)
      ORDER BY created_at DESC, id
      LIMIT ? OFFSET ?
    `).bind(query, query, query, query, limit + 1, offset).all<PatientRow>()
    : await env.DB.prepare(`
      SELECT id, name, age, gender, phone, lab_technician_id,
             sample_collector_id, referrer_id, created_by_sample_collector, created_at
      FROM patients
      WHERE archived_at IS NULL AND created_by_user_id = ?
        AND (? = '' OR instr(lower(name), lower(?)) > 0
          OR instr(lower(phone), lower(?)) > 0 OR instr(lower(id), lower(?)) > 0)
      ORDER BY created_at DESC, id
      LIMIT ? OFFSET ?
    `).bind(user.id, query, query, query, query, limit + 1, offset).all<PatientRow>()

  const hasMore = rows.results.length > limit
  const patients = rows.results.slice(0, limit).map(toPatient)
  return jsonResponse({
    patients,
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  })
}

function readPatientInput(body: Record<string, unknown> | null) {
  if (!body) return null
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const age = body.age
  const gender = body.gender
  const labTechnicianId = optionalId(body.labTechnicianId)
  const sampleCollectorId = optionalId(body.sampleCollectorId)
  const referrerId = optionalId(body.referrerId)
  if (
    !name || name.length > 120 || !phone || phone.length > 40 ||
    typeof age !== 'number' || !Number.isInteger(age) || age < 0 || age > 120 ||
    typeof gender !== 'string' || !validGenders.has(gender) ||
    !labTechnicianId.valid || !sampleCollectorId.valid || !referrerId.valid
  ) {
    return null
  }
  return {
    name,
    phone,
    age,
    gender,
    labTechnicianId: labTechnicianId.value,
    sampleCollectorId: sampleCollectorId.value,
    referrerId: referrerId.value,
  }
}

async function createPatient(request: Request, env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const input = readPatientInput(await readJson(request))
  if (!input) return jsonResponse({ error: 'Enter valid patient details.' }, 400)

  let labTechnicianId = input.labTechnicianId
  let sampleCollectorId = input.sampleCollectorId
  let createdBySampleCollector = 0
  if (user.role === 'sample-collector') {
    if (!user.sampleCollectorId) {
      return jsonResponse({ error: 'The account is not linked to an active sample collector.' }, 403)
    }
    if (sampleCollectorId && sampleCollectorId !== user.sampleCollectorId) {
      return jsonResponse({ error: 'You can register patients only under your sample collector account.' }, 403)
    }
    if (labTechnicianId) {
      return jsonResponse({ error: 'Sample collectors cannot assign a lab technician.' }, 403)
    }
    labTechnicianId = null
    sampleCollectorId = user.sampleCollectorId
    createdBySampleCollector = 1
  }

  const [technicianExists, collectorExists, referrerExists] = await Promise.all([
    activeReferenceExists(env, 'lab_technicians', labTechnicianId),
    activeReferenceExists(env, 'sample_collectors', sampleCollectorId),
    activeReferenceExists(env, 'referrers', input.referrerId),
  ])
  if (!technicianExists || !collectorExists || !referrerExists) {
    return jsonResponse({ error: 'A selected lab assignment is unavailable.' }, 400)
  }

  const patientId = `PT-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO patients (
        id, name, age, gender, phone, lab_technician_id, sample_collector_id,
        referrer_id, created_by_sample_collector, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      patientId,
      input.name,
      input.age,
      input.gender,
      input.phone,
      labTechnicianId,
      sampleCollectorId,
      input.referrerId,
      createdBySampleCollector,
      user.id,
      now,
      now,
    ),
    env.DB.prepare(`
      INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, created_at)
      SELECT ?, ?, 'patient_registered', 'patient', ?, ?
      WHERE EXISTS (SELECT 1 FROM patients WHERE id = ?)
    `).bind(crypto.randomUUID(), user.id, patientId, now, patientId),
  ])
  if (results[0]?.meta.changes !== 1) {
    return jsonResponse({ error: 'Patient could not be registered.' }, 409)
  }
  return jsonResponse({
    patient: {
      id: patientId,
      ...input,
      labTechnicianId,
      sampleCollectorId,
      createdBySampleCollector: createdBySampleCollector === 1,
      createdAt: now,
    },
  }, 201)
}

async function updatePatient(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  patientId: string,
): Promise<Response> {
  if (!isManager(user)) return jsonResponse({ error: 'You do not have permission to update patient records.' }, 403)
  const input = readPatientInput(await readJson(request))
  if (!input) return jsonResponse({ error: 'Enter valid patient details.' }, 400)

  const existing = await env.DB.prepare(`
    SELECT created_by_sample_collector, sample_collector_id, referrer_id
    FROM patients WHERE id = ? AND archived_at IS NULL
  `).bind(patientId).first<{
    created_by_sample_collector: number
    sample_collector_id: string | null
    referrer_id: string | null
  }>()
  if (!existing) return jsonResponse({ error: 'Patient not found.' }, 404)

  const sampleCollectorId = existing.created_by_sample_collector
    ? existing.sample_collector_id
    : input.sampleCollectorId
  const referrerId = existing.created_by_sample_collector ? existing.referrer_id : input.referrerId
  const [technicianExists, collectorExists, referrerExists] = await Promise.all([
    activeReferenceExists(env, 'lab_technicians', input.labTechnicianId),
    activeReferenceExists(env, 'sample_collectors', sampleCollectorId),
    activeReferenceExists(env, 'referrers', referrerId),
  ])
  if (!technicianExists || !collectorExists || !referrerExists) {
    return jsonResponse({ error: 'A selected lab assignment is unavailable.' }, 400)
  }

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE patients
      SET name = ?, age = ?, gender = ?, phone = ?, lab_technician_id = ?,
          sample_collector_id = ?, referrer_id = ?, updated_at = ?
      WHERE id = ? AND archived_at IS NULL
    `).bind(
      input.name,
      input.age,
      input.gender,
      input.phone,
      input.labTechnicianId,
      sampleCollectorId,
      referrerId,
      now,
      patientId,
    ),
    env.DB.prepare(`
      INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (?, ?, 'patient_updated', 'patient', ?, ?)
    `).bind(crypto.randomUUID(), user.id, patientId, now),
  ])
  return jsonResponse({
    patient: {
      id: patientId,
      ...input,
      sampleCollectorId,
      referrerId,
      createdBySampleCollector: existing.created_by_sample_collector === 1,
      createdAt: (await env.DB.prepare('SELECT created_at FROM patients WHERE id = ?')
        .bind(patientId).first<{ created_at: string }>())?.created_at ?? now,
    },
  })
}

async function listTests(env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const tests = await env.DB.prepare(`
    SELECT id, name, category, price_paise, unit, reference
    FROM tests
    WHERE archived_at IS NULL
    ORDER BY name, id
  `).all<TestRow>()
  const [profileRows, parameterRows, reagentRows] = await Promise.all([
    env.DB.prepare(`
      SELECT test_id, profile_id FROM test_profile_tests ORDER BY sort_order
    `).all<TestProfileRow>(),
    env.DB.prepare(`
      SELECT id, test_id, name, unit, reference, group_id, group_name
      FROM test_parameters
      WHERE archived_at IS NULL
      ORDER BY test_id, sort_order
    `).all<ParameterRow>(),
    isManager(user)
      ? env.DB.prepare(`
        SELECT test_id, item_id, quantity_hundredths
        FROM test_reagents
        ORDER BY test_id, item_id
      `).all<ReagentRow>()
      : Promise.resolve({ results: [] as ReagentRow[] }),
  ])
  const profilesByTest = new Map<string, string[]>()
  for (const row of profileRows.results) {
    const profiles = profilesByTest.get(row.test_id) ?? []
    profiles.push(row.profile_id)
    profilesByTest.set(row.test_id, profiles)
  }
  const parametersByTest = new Map<string, ParameterRow[]>()
  for (const row of parameterRows.results) {
    const parameters = parametersByTest.get(row.test_id) ?? []
    parameters.push(row)
    parametersByTest.set(row.test_id, parameters)
  }
  const reagentsByTest = new Map<string, ReagentRow[]>()
  for (const row of reagentRows.results) {
    const reagents = reagentsByTest.get(row.test_id) ?? []
    reagents.push(row)
    reagentsByTest.set(row.test_id, reagents)
  }
  return jsonResponse({
    tests: tests.results.map((test) => {
      const profiles = profilesByTest.get(test.id) ?? []
      const response: Record<string, unknown> = {
        id: test.id,
        name: test.name,
        category: test.category,
        unit: test.unit,
        reference: test.reference,
        profiles: profiles.length ? profiles : ['other'],
      }
      if (isManager(user)) {
        response.price = test.price_paise / 100
        response.parameters = (parametersByTest.get(test.id) ?? []).map((parameter) => ({
          id: parameter.id,
          name: parameter.name,
          unit: parameter.unit,
          reference: parameter.reference,
          groupId: parameter.group_id,
          groupName: parameter.group_name,
        }))
        response.reagents = (reagentsByTest.get(test.id) ?? []).map((reagent) => ({
          itemId: reagent.item_id,
          quantity: reagent.quantity_hundredths / 100,
        }))
      }
      return response
    }),
  })
}

async function createOrders(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  patientId: string,
): Promise<Response> {
  const body = await readJson(request, 8_192)
  const profile = body?.profile
  const testIds = body?.testIds
  if (
    (profile !== 'preoperative' && profile !== 'anc' && profile !== 'other') ||
    !Array.isArray(testIds) ||
    testIds.length < 1 || testIds.length > 50 ||
    testIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 128) ||
    new Set(testIds).size !== testIds.length
  ) {
    return jsonResponse({ error: 'Select a valid profile and one or more tests.' }, 400)
  }

  const patientQuery = isManager(user)
    ? env.DB.prepare('SELECT id FROM patients WHERE id = ? AND archived_at IS NULL')
      .bind(patientId)
    : env.DB.prepare(`
      SELECT id FROM patients
      WHERE id = ? AND archived_at IS NULL AND created_by_user_id = ?
    `).bind(patientId, user.id)
  const patient = await patientQuery.first<{ id: string }>()
  if (!patient) return jsonResponse({ error: 'Patient not found.' }, 404)

  const placeholders = testIds.map(() => '?').join(', ')
  const profileClause = profile === 'other'
    ? 'NOT EXISTS (SELECT 1 FROM test_profile_tests WHERE test_id = tests.id)'
    : 'EXISTS (SELECT 1 FROM test_profile_tests WHERE test_id = tests.id AND profile_id = ?)'
  const binds = profile === 'other' ? testIds : [...testIds, profile]
  const selectedTests = await env.DB.prepare(`
    SELECT id FROM tests
    WHERE archived_at IS NULL AND id IN (${placeholders}) AND ${profileClause}
  `).bind(...binds).all<{ id: string }>()
  if (selectedTests.results.length !== testIds.length) {
    return jsonResponse({ error: 'One or more selected tests are unavailable for this profile.' }, 400)
  }

  const now = new Date().toISOString()
  const orders = testIds.map((testId) => ({
    id: `ORD-${crypto.randomUUID()}`,
    patientId,
    testId,
    createdAt: now,
    status: 'Pending',
  }))
  const statements = orders.map((order) => env.DB.prepare(`
    INSERT INTO lab_orders (id, patient_id, test_id, created_by_user_id, created_at, status)
    VALUES (?, ?, ?, ?, ?, 'Pending')
  `).bind(order.id, order.patientId, order.testId, user.id, order.createdAt))
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'orders_created', 'patient', ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    patientId,
    JSON.stringify({ orderCount: orders.length }),
    now,
  ))
  await env.DB.batch(statements)
  return jsonResponse({ orders }, 201)
}

async function listOrders(request: Request, env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  const status = url.searchParams.get('status') ?? 'All'
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const limitValue = url.searchParams.get('limit')
  const offsetValue = url.searchParams.get('offset')
  const limit = limitValue === null ? 50 : Number(limitValue)
  const offset = offsetValue === null ? 0 : Number(offsetValue)
  const rangeDays = from && to
    ? (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1
    : 0
  if (
    query.length > 100 ||
    (status !== 'All' && status !== 'Pending' && status !== 'Completed') ||
    (from && !isIsoDate(from)) || (to && !isIsoDate(to)) ||
    (from && to && (from > to || rangeDays > 366)) ||
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isInteger(offset) || offset < 0 || offset > 10_000
  ) {
    return jsonResponse({ error: 'Invalid order search or pagination parameters.' }, 400)
  }

  const rows = await env.DB.prepare(`
    SELECT
      orders.id,
      orders.patient_id,
      patients.name AS patient_name,
      patients.age AS patient_age,
      patients.gender AS patient_gender,
      patients.phone AS patient_phone,
      orders.test_id,
      tests.name AS test_name,
      tests.category AS test_category,
      tests.unit AS test_unit,
      tests.reference AS test_reference,
      orders.created_at,
      orders.result,
      orders.status,
      orders.reagents_deducted_at,
      orders.printed_at
    FROM lab_orders AS orders
    JOIN patients ON patients.id = orders.patient_id
    JOIN tests ON tests.id = orders.test_id
    WHERE (? = 1 OR patients.created_by_user_id = ?)
      AND (? = 'All' OR orders.status = ?)
      AND (? = '' OR orders.created_at >= ?)
      AND (? = '' OR orders.created_at < ?)
      AND (? = '' OR instr(lower(orders.id), lower(?)) > 0
        OR instr(lower(patients.id), lower(?)) > 0
        OR instr(lower(patients.name), lower(?)) > 0
        OR instr(lower(tests.name), lower(?)) > 0)
    ORDER BY orders.created_at DESC, orders.id
    LIMIT ? OFFSET ?
  `).bind(
    isManager(user) ? 1 : 0,
    user.id,
    status,
    status,
    from,
    from ? localDateStartUtc(from) : '',
    to,
    to ? localDateStartUtc(nextIsoDate(to)) : '',
    query,
    query,
    query,
    query,
    query,
    limit + 1,
    offset,
  ).all<OrderRow>()

  const hasMore = rows.results.length > limit
  const page = rows.results.slice(0, limit)
  if (!page.length) {
    return jsonResponse({
      orders: [],
      pagination: { limit, offset, hasMore: false, nextOffset: null },
    })
  }

  const placeholders = page.map(() => '?').join(', ')
  const testIds = [...new Set(page.map((order) => order.test_id))]
  const testPlaceholders = testIds.map(() => '?').join(', ')
  const [parameters, resultRows] = await Promise.all([
    env.DB.prepare(`
      SELECT id, test_id, name, unit, reference, group_id, group_name, sort_order
      FROM test_parameters
      WHERE test_id IN (${testPlaceholders})
      ORDER BY test_id, sort_order
    `).bind(...testIds).all<OrderTestParameterRow>(),
    env.DB.prepare(`
      SELECT order_id, parameter_id, value
      FROM order_results
      WHERE order_id IN (${placeholders})
    `).bind(...page.map((order) => order.id)).all<OrderResultRow>(),
  ])
  const parametersByTest = new Map<string, OrderTestParameterRow[]>()
  for (const parameter of parameters.results) {
    const list = parametersByTest.get(parameter.test_id) ?? []
    list.push(parameter)
    parametersByTest.set(parameter.test_id, list)
  }
  const resultsByOrder = new Map<string, Record<string, string>>()
  for (const row of resultRows.results) {
    const values = resultsByOrder.get(row.order_id) ?? {}
    values[row.parameter_id] = row.value
    resultsByOrder.set(row.order_id, values)
  }

  return jsonResponse({
    orders: page.map((order) => ({
      id: order.id,
      patientId: order.patient_id,
      patient: {
        id: order.patient_id,
        name: order.patient_name,
        age: order.patient_age,
        gender: order.patient_gender,
        phone: order.patient_phone,
      },
      testId: order.test_id,
      test: {
        id: order.test_id,
        name: order.test_name,
        category: order.test_category,
        unit: order.test_unit,
        reference: order.test_reference,
      },
      createdAt: order.created_at,
      result: isManager(user) ? order.result : '',
      parameterResults: isManager(user) ? resultsByOrder.get(order.id) ?? {} : {},
      parameters: (isManager(user) ? parametersByTest.get(order.test_id) ?? [] : []).map((parameter) => ({
        id: parameter.id,
        name: parameter.name,
        unit: parameter.unit,
        reference: parameter.reference,
        groupId: parameter.group_id,
        groupName: parameter.group_name,
      })),
      status: order.status,
      reagentsDeductedAt: order.reagents_deducted_at,
      printedAt: order.printed_at,
    })),
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  })
}

async function markOrdersPrinted(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
): Promise<Response> {
  const body = await readJson(request, 8_192)
  const orderIds = body?.orderIds
  if (!Array.isArray(orderIds) || orderIds.length < 1 || orderIds.length > 100 ||
    orderIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 128) ||
    new Set(orderIds).size !== orderIds.length) {
    return jsonResponse({ error: 'Provide one or more valid test order IDs.' }, 400)
  }
  const placeholders = orderIds.map(() => '?').join(', ')
  const found = await env.DB.prepare(`
    SELECT id FROM lab_orders WHERE id IN (${placeholders})
  `).bind(...orderIds).all<{ id: string }>()
  if (found.results.length !== orderIds.length) {
    return jsonResponse({ error: 'One or more test orders could not be found.' }, 404)
  }
  const printedAt = new Date().toISOString()
  const statements: D1PreparedStatement[] = orderIds.map((id) => env.DB.prepare(`
    UPDATE lab_orders SET printed_at = ? WHERE id = ?
  `).bind(printedAt, id))
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, 'orders_printed', 'order_batch', ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    orderIds.join(','),
    JSON.stringify({ orderCount: orderIds.length }),
    printedAt,
  ))
  await env.DB.batch(statements)
  return jsonResponse({ printedAt, orderIds })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function orderIsCompleteSql(): string {
  const requiredParameters = `
    SELECT 1 FROM test_parameters AS parameters
    WHERE parameters.test_id = lab_orders.test_id AND parameters.archived_at IS NULL
  `
  const missingResults = `
    SELECT 1 FROM test_parameters AS parameters
    WHERE parameters.test_id = lab_orders.test_id AND parameters.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM order_results
        WHERE order_results.order_id = lab_orders.id
          AND order_results.parameter_id = parameters.id
          AND trim(order_results.value) <> ''
      )
  `
  return `(
    (EXISTS (${requiredParameters}) AND NOT EXISTS (${missingResults}))
    OR (NOT EXISTS (${requiredParameters}) AND trim(lab_orders.result) <> '')
  )`
}

async function saveOrderResults(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  orderId: string,
): Promise<Response> {
  const body = await readJson(request, 16_384)
  if (!body) return jsonResponse({ error: 'Enter valid result data.' }, 400)

  const order = await env.DB.prepare(`
    SELECT id, test_id, result FROM lab_orders WHERE id = ?
  `).bind(orderId).first<{ id: string; test_id: string; result: string }>()
  if (!order) return jsonResponse({ error: 'Test order not found.' }, 404)

  const parameters = await env.DB.prepare(`
    SELECT id, sort_order FROM test_parameters
    WHERE test_id = ? AND archived_at IS NULL
    ORDER BY sort_order
  `).bind(order.test_id).all<{ id: string; sort_order: number }>()

  const now = new Date().toISOString()
  let changedCount = 0
  const statements: D1PreparedStatement[] = []
  if (parameters.results.length) {
    if (!isRecord(body.parameterResults)) {
      return jsonResponse({ error: 'Provide results for one or more test parameters.' }, 400)
    }
    const allowedParameterIds = new Set(parameters.results.map((parameter) => parameter.id))
    const updates: Array<[string, string]> = []
    for (const [parameterId, value] of Object.entries(body.parameterResults)) {
      if (!allowedParameterIds.has(parameterId) || typeof value !== 'string' || value.length > 1_000) {
        return jsonResponse({ error: 'One or more parameter results are invalid.' }, 400)
      }
      updates.push([parameterId, value])
    }
    if (!updates.length) {
      return jsonResponse({ error: 'One or more parameter results are invalid.' }, 400)
    }
    const existing = await env.DB.prepare(`
      SELECT parameter_id, value FROM order_results WHERE order_id = ?
    `).bind(order.id).all<{ parameter_id: string; value: string }>()
    const valuesByParameter = new Map(existing.results.map((row) => [row.parameter_id, row.value]))
    for (const [parameterId, value] of updates) {
      valuesByParameter.set(parameterId, value.trim())
    }
    if (!Array.from(valuesByParameter.values()).some((value) => value.trim())) {
      return jsonResponse({ error: 'Enter at least one parameter result before saving.' }, 400)
    }

    changedCount = updates.length
    const valueTuples = updates.map(() => '(?, ?, ?, ?, ?)').join(', ')
    statements.push(env.DB.prepare(`
      INSERT INTO order_results (order_id, parameter_id, value, updated_by_user_id, updated_at)
      VALUES ${valueTuples}
      ON CONFLICT(order_id, parameter_id) DO UPDATE SET
        value = excluded.value,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at
    `).bind(...updates.flatMap(([parameterId, value]) => [
      order.id,
      parameterId,
      value.trim(),
      user.id,
      now,
    ])))
  } else {
    const result = body.result
    if (typeof result !== 'string' || !result.trim() || result.length > 2_000) {
      return jsonResponse({ error: 'Enter a result before saving this order.' }, 400)
    }
    changedCount = 1
    statements.push(env.DB.prepare(`
      UPDATE lab_orders SET result = ? WHERE id = ?
    `).bind(result.trim(), order.id))
  }

  const completeSql = orderIsCompleteSql()
  statements.push(env.DB.prepare(`
    INSERT INTO stock_movements (
      id, item_id, source_type, source_id, quantity_delta_hundredths,
      created_by_user_id, created_at
    )
    SELECT
      'order:' || lab_orders.id || ':' || test_reagents.item_id,
      test_reagents.item_id,
      'order',
      lab_orders.id,
      -test_reagents.quantity_hundredths,
      ?,
      ?
    FROM lab_orders
    JOIN test_reagents ON test_reagents.test_id = lab_orders.test_id
    WHERE lab_orders.id = ?
      AND lab_orders.reagents_deducted_at IS NULL
      AND ${completeSql}
      AND NOT EXISTS (
        SELECT 1 FROM stock_movements
        WHERE item_id = test_reagents.item_id
          AND source_type = 'order'
          AND source_id = lab_orders.id
      )
  `).bind(user.id, now, order.id))
  statements.push(env.DB.prepare(`
    UPDATE lab_orders
    SET result = CASE
          WHEN EXISTS (
            SELECT 1 FROM test_parameters
            WHERE test_id = lab_orders.test_id AND archived_at IS NULL
          ) THEN COALESCE((
            SELECT order_results.value
            FROM order_results
            JOIN test_parameters ON test_parameters.id = order_results.parameter_id
            WHERE order_results.order_id = lab_orders.id
              AND test_parameters.archived_at IS NULL
            ORDER BY test_parameters.sort_order
            LIMIT 1
          ), '')
          ELSE result
        END,
        status = CASE WHEN ${completeSql} THEN 'Completed' ELSE 'Pending' END,
        reagents_deducted_at = CASE
          WHEN ${completeSql}
            AND EXISTS (SELECT 1 FROM test_reagents WHERE test_id = lab_orders.test_id)
          THEN COALESCE(reagents_deducted_at, ?)
          ELSE reagents_deducted_at
        END,
        printed_at = NULL
    WHERE id = ?
  `).bind(now, order.id))
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, details_json, created_at)
    SELECT ?, ?, 'order_results_saved', 'order', ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM lab_orders WHERE id = ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    order.id,
    JSON.stringify({ changedCount, parameterized: parameters.results.length > 0 }),
    now,
    order.id,
  ))

  try {
    await env.DB.batch(statements)
  } catch (error) {
    const message = String(error).toLowerCase()
    if (message.includes('insufficient reagent stock')) {
      return jsonResponse({ error: 'Insufficient reagent stock to complete this test.' }, 409)
    }
    if (message.includes('inventory item is unavailable')) {
      return jsonResponse({ error: 'A reagent is archived or unavailable.' }, 409)
    }
    throw error
  }

  const saved = await env.DB.prepare(`
    SELECT result, status, reagents_deducted_at, printed_at
    FROM lab_orders WHERE id = ?
  `).bind(order.id).first<{
    result: string
    status: 'Pending' | 'Completed'
    reagents_deducted_at: string | null
    printed_at: string | null
  }>()
  const savedResults = parameters.results.length
    ? await env.DB.prepare(`
      SELECT parameter_id, value FROM order_results WHERE order_id = ?
    `).bind(order.id).all<{ parameter_id: string; value: string }>()
    : null
  return jsonResponse({
    order: {
      id: order.id,
      result: saved?.result ?? '',
      parameterResults: Object.fromEntries(
        (savedResults?.results ?? []).map((row) => [row.parameter_id, row.value]),
      ),
      status: saved?.status ?? 'Pending',
      reagentsDeductedAt: saved?.reagents_deducted_at ?? null,
      printedAt: saved?.printed_at ?? null,
    },
  })
}

async function listAttendance(request: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!from || !to || !isIsoDate(from) || !isIsoDate(to) || from > to) {
    return jsonResponse({ error: 'Provide a valid attendance date range.' }, 400)
  }
  const dayCount = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1
  if (dayCount > 366) {
    return jsonResponse({ error: 'Attendance date ranges cannot exceed 366 days.' }, 400)
  }

  const rows = await env.DB.prepare(`
    SELECT
      records.technician_id,
      technicians.name AS technician_name,
      technicians.specialty AS technician_specialty,
      records.attendance_date,
      records.status,
      records.updated_at
    FROM attendance_records AS records
    JOIN lab_technicians AS technicians ON technicians.id = records.technician_id
    WHERE records.attendance_date BETWEEN ? AND ?
    ORDER BY records.attendance_date DESC, technicians.name COLLATE NOCASE
  `).bind(from, to).all<AttendanceRecordRow>()

  return jsonResponse({
    records: rows.results.map((record) => ({
      id: `${record.attendance_date}:${record.technician_id}`,
      labTechnicianId: record.technician_id,
      technician: {
        id: record.technician_id,
        name: record.technician_name,
        specialty: record.technician_specialty,
      },
      date: record.attendance_date,
      status: record.status,
      updatedAt: record.updated_at,
    })),
  })
}

async function saveAttendance(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  date: string,
): Promise<Response> {
  if (!isIsoDate(date)) return jsonResponse({ error: 'Enter a valid attendance date.' }, 400)
  const body = await readJson(request, 32_768)
  if (!body || !isRecord(body.statuses)) {
    return jsonResponse({ error: 'Provide attendance statuses by technician ID.' }, 400)
  }
  const entries = Object.entries(body.statuses)
  if (entries.length > 200) {
    return jsonResponse({ error: 'Too many technician attendance entries.' }, 400)
  }
  const statuses: Array<[string, string]> = []
  for (const [technicianId, status] of entries) {
    if (
      !technicianId.trim() ||
      technicianId.length > 128 ||
      typeof status !== 'string' ||
      (status !== '' && !attendanceStatuses.has(status))
    ) {
      return jsonResponse({ error: 'One or more attendance entries are invalid.' }, 400)
    }
    statuses.push([technicianId, status])
  }

  const activeTechnicians = await env.DB.prepare(`
    SELECT id FROM lab_technicians WHERE archived_at IS NULL
  `).all<{ id: string }>()
  const activeIds = new Set(activeTechnicians.results.map((technician) => technician.id))
  if (statuses.some(([technicianId]) => !activeIds.has(technicianId))) {
    return jsonResponse({ error: 'One or more lab technicians are unavailable.' }, 400)
  }

  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      DELETE FROM attendance_records
      WHERE attendance_date = ?
        AND technician_id IN (
          SELECT id FROM lab_technicians WHERE archived_at IS NULL
        )
    `).bind(date),
  ]
  for (const [technicianId, status] of statuses) {
    if (!status) continue
    statements.push(env.DB.prepare(`
      INSERT INTO attendance_records (
        technician_id, attendance_date, status, updated_by_user_id, updated_at
      )
      SELECT id, ?, ?, ?, ?
      FROM lab_technicians
      WHERE id = ? AND archived_at IS NULL
      ON CONFLICT(technician_id, attendance_date) DO UPDATE SET
        status = excluded.status,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at
    `).bind(date, status, user.id, now, technicianId))
  }
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events (
      id, actor_user_id, action, entity_type, entity_id, details_json, created_at
    )
    VALUES (?, ?, 'attendance_saved', 'attendance_date', ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    date,
    JSON.stringify({ recordCount: statuses.filter(([, status]) => status !== '').length }),
    now,
  ))
  await env.DB.batch(statements)

  return jsonResponse({
    date,
    records: statuses.flatMap(([technicianId, status]) =>
      status
        ? [{ id: `${date}:${technicianId}`, labTechnicianId: technicianId, date, status, updatedAt: now }]
        : [],
    ),
  })
}

async function createInvoice(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
): Promise<Response> {
  const body = await readJson(request, 8_192)
  const patientId = body?.patientId
  const testIds = body?.testIds
  const discount = body?.discount
  const status = body?.status
  const paymentMethod = body?.paymentMethod
  const date = body?.date
  if (
    typeof patientId !== 'string' || !patientId.trim() || patientId.length > 128 ||
    !Array.isArray(testIds) || testIds.length < 1 || testIds.length > 50 ||
    testIds.some((id) => typeof id !== 'string' || !id.trim() || id.length > 128) ||
    new Set(testIds).size !== testIds.length ||
    typeof discount !== 'number' || !Number.isFinite(discount) || discount < 0 ||
    !Number.isSafeInteger(Math.round(discount * 100)) ||
    (status !== 'Paid' && status !== 'Unpaid') ||
    (paymentMethod !== '' && paymentMethod !== 'Cash' && paymentMethod !== 'Online') ||
    (status === 'Paid' && !paymentMethod) ||
    (status === 'Unpaid' && paymentMethod !== '') ||
    typeof date !== 'string' || !isIsoDate(date)
  ) {
    return jsonResponse({ error: 'Provide a valid patient, tests, discount, payment status, and invoice date.' }, 400)
  }

  const patient = await env.DB.prepare(`
    SELECT id, name, phone
    FROM patients
    WHERE id = ? AND archived_at IS NULL
  `).bind(patientId).first<{ id: string; name: string; phone: string }>()
  if (!patient) return jsonResponse({ error: 'Patient not found.' }, 404)

  const placeholders = testIds.map(() => '?').join(', ')
  const tests = await env.DB.prepare(`
    SELECT id, name, price_paise
    FROM tests
    WHERE archived_at IS NULL AND price_paise > 0 AND id IN (${placeholders})
  `).bind(...testIds).all<InvoiceTestRow>()
  if (tests.results.length !== testIds.length) {
    return jsonResponse({ error: 'One or more selected tests are unavailable or not billable.' }, 400)
  }

  const testsById = new Map(tests.results.map((test) => [test.id, test]))
  const orderedTests = testIds
    .map((testId) => testsById.get(testId))
    .filter((test): test is InvoiceTestRow => test !== undefined)
  const subtotalPaise = orderedTests.reduce((total, test) => total + test.price_paise, 0)
  const discountPaise = Math.round(discount * 100)
  const amountPaise = Math.max(0, subtotalPaise - discountPaise)
  if (!Number.isSafeInteger(subtotalPaise) || !Number.isSafeInteger(amountPaise)) {
    return jsonResponse({ error: 'The invoice amount is outside the supported range.' }, 400)
  }

  const invoiceId = `INV-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO invoices (
        id, patient_id, patient_name, patient_phone, discount_paise, amount_paise,
        status, payment_method, invoice_date, created_by_user_id, created_at
      )
      SELECT ?, patients.id, patients.name, patients.phone, ?, ?, ?, ?, ?, ?, ?
      FROM patients
      WHERE patients.id = ? AND patients.archived_at IS NULL
        AND (SELECT COUNT(*) FROM tests
          WHERE id IN (${placeholders}) AND archived_at IS NULL AND price_paise > 0) = ?
        AND NOT EXISTS (
          SELECT 1 FROM invoices
          WHERE patient_id = patients.id AND status = 'Paid'
        )
    `).bind(
      invoiceId,
      discountPaise,
      amountPaise,
      status,
      paymentMethod,
      date,
      user.id,
      now,
      patient.id,
      ...testIds,
      testIds.length,
    ),
  ]
  orderedTests.forEach((test, sortOrder) => {
    statements.push(env.DB.prepare(`
      INSERT INTO invoice_items (id, invoice_id, test_id, test_name, amount_paise, sort_order)
      SELECT ?, invoices.id, tests.id, tests.name, tests.price_paise, ?
      FROM invoices
      JOIN tests ON tests.id = ?
      WHERE invoices.id = ? AND tests.archived_at IS NULL AND tests.price_paise > 0
    `).bind(crypto.randomUUID(), sortOrder, test.id, invoiceId))
  })
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events (
      id, actor_user_id, action, entity_type, entity_id, details_json, created_at
    )
    SELECT ?, ?, 'invoice_created', 'invoice', ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    invoiceId,
    JSON.stringify({ itemCount: tests.results.length, status }),
    now,
    invoiceId,
  ))
  await env.DB.batch(statements)

  const inserted = await env.DB.prepare(`
    SELECT id FROM invoices WHERE id = ?
  `).bind(invoiceId).first<{ id: string }>()
  if (!inserted) {
    const paidInvoice = await env.DB.prepare(`
      SELECT id FROM invoices WHERE patient_id = ? AND status = 'Paid' LIMIT 1
    `).bind(patient.id).first<{ id: string }>()
    if (paidInvoice) return jsonResponse({ error: 'This patient already has a paid invoice.' }, 409)
    return jsonResponse({ error: 'The patient or one of the selected tests changed. Refresh and try again.' }, 409)
  }

  return jsonResponse({
    invoice: {
      id: invoiceId,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      items: orderedTests.map((test) => ({
        testId: test.id,
        name: test.name,
        amount: test.price_paise / 100,
      })),
      discount: discountPaise / 100,
      amount: amountPaise / 100,
      status,
      paymentMethod,
      date,
    },
  }, 201)
}

function invoiceResponse(invoice: InvoiceRow, items: InvoiceItemRow[]) {
  return {
    id: invoice.id,
    patientId: invoice.patient_id,
    patientName: invoice.patient_name,
    patientPhone: invoice.patient_phone,
    items: items
      .filter((item) => item.invoice_id === invoice.id)
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((item) => ({
        testId: item.test_id,
        name: item.test_name,
        amount: item.amount_paise / 100,
      })),
    discount: invoice.discount_paise / 100,
    amount: invoice.amount_paise / 100,
    status: invoice.status,
    paymentMethod: invoice.payment_method,
    date: invoice.invoice_date,
  }
}

async function listInvoices(request: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url)
  const limitValue = url.searchParams.get('limit')
  const offsetValue = url.searchParams.get('offset')
  const limit = limitValue === null ? 50 : Number(limitValue)
  const offset = offsetValue === null ? 0 : Number(offsetValue)
  if (
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isInteger(offset) || offset < 0 || offset > 10_000
  ) {
    return jsonResponse({ error: 'Invalid invoice pagination.' }, 400)
  }

  const rows = await env.DB.prepare(`
    SELECT id, patient_id, patient_name, patient_phone, discount_paise,
      amount_paise, status, payment_method, invoice_date
    FROM invoices
    ORDER BY invoice_date DESC, created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).bind(limit + 1, offset).all<InvoiceRow>()
  const hasMore = rows.results.length > limit
  const page = rows.results.slice(0, limit)
  if (!page.length) {
    return jsonResponse({
      invoices: [],
      pagination: { limit, offset, hasMore: false, nextOffset: null },
    })
  }
  const placeholders = page.map(() => '?').join(', ')
  const items = await env.DB.prepare(`
    SELECT id, invoice_id, test_id, test_name, amount_paise, sort_order
    FROM invoice_items
    WHERE invoice_id IN (${placeholders})
    ORDER BY invoice_id, sort_order
  `).bind(...page.map((invoice) => invoice.id)).all<InvoiceItemRow>()
  return jsonResponse({
    invoices: page.map((invoice) => invoiceResponse(invoice, items.results)),
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  })
}

async function updateInvoicePayment(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  invoiceId: string,
): Promise<Response> {
  const body = await readJson(request, 2_048)
  const status = body?.status
  const paymentMethod = body?.paymentMethod
  if (
    (status !== 'Paid' && status !== 'Unpaid') ||
    (paymentMethod !== '' && paymentMethod !== 'Cash' && paymentMethod !== 'Online') ||
    (status === 'Paid' && !paymentMethod) ||
    (status === 'Unpaid' && paymentMethod !== '')
  ) {
    return jsonResponse({ error: 'Provide a valid invoice payment status and method.' }, 400)
  }

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE invoices
      SET status = ?, payment_method = ?
      WHERE id = ?
    `).bind(status, paymentMethod, invoiceId),
    env.DB.prepare(`
      INSERT INTO audit_events (
        id, actor_user_id, action, entity_type, entity_id, details_json, created_at
      )
      SELECT ?, ?, 'invoice_payment_updated', 'invoice', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      invoiceId,
      JSON.stringify({ status, paymentMethod }),
      now,
      invoiceId,
    ),
  ])
  const invoice = await env.DB.prepare(`
    SELECT id, patient_id, patient_name, patient_phone, discount_paise,
      amount_paise, status, payment_method, invoice_date
    FROM invoices
    WHERE id = ?
  `).bind(invoiceId).first<InvoiceRow>()
  if (!invoice) return jsonResponse({ error: 'Invoice not found.' }, 404)
  const items = await env.DB.prepare(`
    SELECT id, invoice_id, test_id, test_name, amount_paise, sort_order
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY sort_order
  `).bind(invoiceId).all<InvoiceItemRow>()
  return jsonResponse({ invoice: invoiceResponse(invoice, items.results) })
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

export async function handleDomainRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const patientPath = url.pathname === '/api/patients'
  const patientMatch = url.pathname.match(/^\/api\/patients\/([^/]+)$/)
  const patientOrdersMatch = url.pathname.match(/^\/api\/patients\/([^/]+)\/orders$/)
  const ordersPath = url.pathname === '/api/orders'
  const printOrdersPath = url.pathname === '/api/orders/print'
  const orderResultsMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/results$/)
  const attendancePath = url.pathname === '/api/attendance'
  const attendanceDateMatch = url.pathname.match(/^\/api\/attendance\/([^/]+)$/)
  const invoicesPath = url.pathname === '/api/invoices'
  const invoiceMatch = url.pathname.match(/^\/api\/invoices\/([^/]+)$/)
  if (patientPath && request.method !== 'GET' && request.method !== 'POST') {
    return methodNotAllowed('GET, POST')
  }
  if (patientMatch && request.method !== 'PATCH') return methodNotAllowed('PATCH')
  if (patientOrdersMatch && request.method !== 'POST') return methodNotAllowed('POST')
  if (ordersPath && request.method !== 'GET') return methodNotAllowed('GET')
  if (printOrdersPath && request.method !== 'POST') return methodNotAllowed('POST')
  if (orderResultsMatch && request.method !== 'PUT') return methodNotAllowed('PUT')
  if (attendancePath && request.method !== 'GET') return methodNotAllowed('GET')
  if (attendanceDateMatch && request.method !== 'PUT') return methodNotAllowed('PUT')
  if (invoicesPath && request.method !== 'GET' && request.method !== 'POST') {
    return methodNotAllowed('GET, POST')
  }
  if (invoiceMatch && request.method !== 'PATCH') return methodNotAllowed('PATCH')
  if (!patientPath && !patientMatch && !patientOrdersMatch && !ordersPath && !printOrdersPath &&
    !orderResultsMatch && !attendancePath && !attendanceDateMatch && !invoicesPath &&
    !invoiceMatch &&
    url.pathname !== '/api/tests') return null
  if (url.pathname === '/api/tests' && request.method !== 'GET') return methodNotAllowed('GET')

  try {
    if (url.pathname === '/api/tests') {
      const authorization = await authorizeRequest(request, env, allRoles)
      if ('response' in authorization) return authorization.response
      return await listTests(env, authorization.user)
    }
    if (ordersPath) {
      const authorization = await authorizeRequest(request, env, allRoles)
      if ('response' in authorization) return authorization.response
      return await listOrders(request, env, authorization.user)
    }
    if (printOrdersPath) {
      const authorization = await authorizeRequest(request, env, managerRoles)
      if ('response' in authorization) return authorization.response
      return await markOrdersPrinted(request, env, authorization.user)
    }
    if (orderResultsMatch) {
      const authorization = await authorizeRequest(request, env, managerRoles)
      if ('response' in authorization) return authorization.response
      let orderId: string
      try {
        orderId = decodeURIComponent(orderResultsMatch[1])
      } catch {
        return jsonResponse({ error: 'Invalid test order id.' }, 400)
      }
      return await saveOrderResults(request, env, authorization.user, orderId)
    }
    if (attendancePath) {
      const authorization = await authorizeRequest(request, env, ownerRoles)
      if ('response' in authorization) return authorization.response
      return await listAttendance(request, env)
    }
    if (attendanceDateMatch) {
      const authorization = await authorizeRequest(request, env, ownerRoles)
      if ('response' in authorization) return authorization.response
      let date: string
      try {
        date = decodeURIComponent(attendanceDateMatch[1])
      } catch {
        return jsonResponse({ error: 'Enter a valid attendance date.' }, 400)
      }
      return await saveAttendance(request, env, authorization.user, date)
    }
    if (invoicesPath) {
      const authorization = await authorizeRequest(request, env, managerRoles)
      if ('response' in authorization) return authorization.response
      return request.method === 'GET'
        ? await listInvoices(request, env)
        : await createInvoice(request, env, authorization.user)
    }
    if (invoiceMatch) {
      const authorization = await authorizeRequest(request, env, managerRoles)
      if ('response' in authorization) return authorization.response
      let invoiceId: string
      try {
        invoiceId = decodeURIComponent(invoiceMatch[1])
      } catch {
        return jsonResponse({ error: 'Invalid invoice ID.' }, 400)
      }
      return await updateInvoicePayment(request, env, authorization.user, invoiceId)
    }
    if (patientPath) {
      const authorization = await authorizeRequest(request, env, allRoles)
      if ('response' in authorization) return authorization.response
      return request.method === 'GET'
        ? await listPatients(request, env, authorization.user)
        : await createPatient(request, env, authorization.user)
    }
    if (patientMatch) {
      const authorization = await authorizeRequest(request, env, managerRoles)
      if ('response' in authorization) return authorization.response
      let patientId: string
      try {
        patientId = decodeURIComponent(patientMatch[1])
      } catch {
        return jsonResponse({ error: 'Invalid patient id.' }, 400)
      }
      return await updatePatient(request, env, authorization.user, patientId)
    }

    const authorization = await authorizeRequest(request, env, allRoles)
    if ('response' in authorization) return authorization.response
    let patientId: string
    try {
      patientId = decodeURIComponent(patientOrdersMatch![1])
    } catch {
      return jsonResponse({ error: 'Invalid patient id.' }, 400)
    }
    return await createOrders(request, env, authorization.user, patientId)
  } catch (error) {
    console.error('Unable to process a domain API request.', error)
    return jsonResponse({ error: 'Unable to process this request.' }, 500)
  }
}
