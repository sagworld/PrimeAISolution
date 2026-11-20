import {
  authorizeRequest,
  jsonResponse,
  readJson,
  type AuthEnv,
  type AuthenticatedUser,
  type UserRole,
} from './auth'
import { isIsoDate } from './dateUtils'

type InventoryItemRow = {
  id: string
  name: string
  category: 'equipment' | 'material'
  unit: 'quantity' | 'kg' | 'litre'
  threshold_hundredths: number
  current_stock_hundredths: number
  created_at: string
  archived_at: string | null
  imported_hundredths: number
  expenditure_paise: number
}

type ImportBillRow = {
  id: string
  item_id: string | null
  item_name: string
  supplier_name: string
  quantity_hundredths: number
  unit: 'quantity' | 'kg' | 'litre'
  cost_per_unit_paise: number
  total_cost_paise: number
  purchase_date: string
  created_at: string
  paid_paise: number
}

type BillPaymentRow = {
  id: string
  bill_id: string
  amount_paise: number
  method: 'cash' | 'upi' | 'unspecified'
  paid_at: string
}

type InventoryMovementRow = {
  id: string
  source_type: 'import' | 'order' | 'manual'
  source_id: string
  quantity_delta_hundredths: number
  created_at: string
}

const managerRoles: readonly UserRole[] = ['owner', 'lab-technician']
const units = new Set(['quantity', 'kg', 'litre'])
const categories = new Set(['equipment', 'material'])
const paymentMethods = new Set(['cash', 'upi'])
const paymentStatuses = new Set(['all', 'paid', 'partially paid', 'unpaid'])

function labToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: 'year' | 'month' | 'day') => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function scaledValue(value: unknown, allowZero: boolean): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    return null
  }
  const scaled = Math.round((value + Number.EPSILON) * 100)
  if (!Number.isSafeInteger(scaled) || Math.abs(value * 100 - scaled) > 1e-8) return null
  return scaled
}

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function decodePathId(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function itemResponse(item: InventoryItemRow) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    threshold: item.threshold_hundredths / 100,
    currentStock: item.current_stock_hundredths / 100,
    usedQuantity: Math.max(0, item.imported_hundredths - item.current_stock_hundredths) / 100,
    totalExpenditure: item.expenditure_paise / 100,
    createdAt: item.created_at,
    archivedAt: item.archived_at,
  }
}

function paymentStatus(totalPaise: number, paidPaise: number): 'paid' | 'partially paid' | 'unpaid' {
  if (paidPaise >= totalPaise) return 'paid'
  return paidPaise > 0 ? 'partially paid' : 'unpaid'
}

function billResponse(bill: ImportBillRow, payments: BillPaymentRow[]) {
  const billPayments = payments.filter((payment) => payment.bill_id === bill.id)
  return {
    id: bill.id,
    itemId: bill.item_id,
    itemName: bill.item_name,
    supplierName: bill.supplier_name,
    quantity: bill.quantity_hundredths / 100,
    unit: bill.unit,
    costPerUnit: bill.cost_per_unit_paise / 100,
    totalCost: bill.total_cost_paise / 100,
    payments: billPayments.map((payment) => ({
      id: payment.id,
      amount: payment.amount_paise / 100,
      paidAt: payment.paid_at,
      method: payment.method,
    })),
    status: paymentStatus(bill.total_cost_paise, bill.paid_paise),
    date: bill.purchase_date,
    createdAt: bill.created_at,
  }
}

async function listItems(request: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''
  const includeArchived = url.searchParams.get('includeArchived') === 'true'
  if (query.length > 100) return jsonResponse({ error: 'Search text is too long.' }, 400)
  const rows = await env.DB.prepare(`
    SELECT
      items.id,
      items.name,
      items.category,
      items.unit,
      items.threshold_hundredths,
      items.current_stock_hundredths,
      items.created_at,
      items.archived_at,
      COALESCE((
        SELECT SUM(bills.quantity_hundredths)
        FROM import_bills AS bills
        WHERE bills.item_id = items.id
      ), 0) AS imported_hundredths,
      COALESCE((
        SELECT SUM(bills.total_cost_paise)
        FROM import_bills AS bills
        WHERE bills.item_id = items.id
      ), 0) AS expenditure_paise
    FROM inventory_items AS items
    WHERE (? = 1 OR items.archived_at IS NULL)
      AND (? = '' OR instr(lower(items.name), lower(?)) > 0)
    ORDER BY items.archived_at IS NOT NULL, items.name COLLATE NOCASE
  `).bind(includeArchived ? 1 : 0, query, query).all<InventoryItemRow>()
  return jsonResponse({ items: rows.results.map(itemResponse) })
}

async function createItem(request: Request, env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const body = await readJson(request, 4_096)
  const name = typeof body?.name === 'string' ? normalizedName(body.name) : ''
  const category = body?.category
  const unit = body?.unit
  const threshold = scaledValue(body?.threshold, true)
  if (
    !name || name.length > 120 ||
    typeof category !== 'string' || !categories.has(category) ||
    typeof unit !== 'string' || !units.has(unit) ||
    threshold === null
  ) {
    return jsonResponse({ error: 'Enter a valid item name, category, unit, and non-negative threshold.' }, 400)
  }

  const id = `ITEM-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  try {
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO inventory_items (
          id, name, normalized_name, category, unit, threshold_hundredths,
          current_stock_hundredths, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).bind(id, name, name.toLowerCase(), category, unit, threshold, now, now),
      env.DB.prepare(`
        INSERT INTO audit_events (
          id, actor_user_id, action, entity_type, entity_id, details_json, created_at
        )
        VALUES (?, ?, 'inventory_item_created', 'inventory_item', ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        user.id,
        id,
        JSON.stringify({ category, unit }),
        now,
      ),
    ])
  } catch (error) {
    if (String(error).toLowerCase().includes('inventory_items.normalized_name')) {
      return jsonResponse({ error: 'An inventory item with this name already exists.' }, 409)
    }
    throw error
  }
  return jsonResponse({
    item: {
      id,
      name,
      category,
      unit,
      threshold: threshold / 100,
      currentStock: 0,
      usedQuantity: 0,
      totalExpenditure: 0,
      createdAt: now,
      archivedAt: null,
    },
  }, 201)
}

async function updateItem(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  itemId: string,
): Promise<Response> {
  const body = await readJson(request, 4_096)
  const name = typeof body?.name === 'string' ? normalizedName(body.name) : ''
  const category = body?.category
  const unit = body?.unit
  const threshold = scaledValue(body?.threshold, true)
  if (
    !name || name.length > 120 ||
    typeof category !== 'string' || !categories.has(category) ||
    typeof unit !== 'string' || !units.has(unit) ||
    threshold === null
  ) {
    return jsonResponse({ error: 'Enter a valid item name, category, unit, and non-negative threshold.' }, 400)
  }
  const existing = await env.DB.prepare(`
    SELECT id, category, unit, archived_at
    FROM inventory_items WHERE id = ?
  `).bind(itemId).first<{
    id: string
    category: 'equipment' | 'material'
    unit: 'quantity' | 'kg' | 'litre'
    archived_at: string | null
  }>()
  if (!existing || existing.archived_at) return jsonResponse({ error: 'Inventory item not found.' }, 404)
  if (unit !== existing.unit) {
    const referenced = await env.DB.prepare(`
      SELECT id FROM import_bills WHERE item_id = ?
      UNION ALL
      SELECT item_id FROM test_reagents WHERE item_id = ?
      LIMIT 1
    `).bind(itemId, itemId).first()
    if (referenced) return jsonResponse({ error: 'The unit cannot be changed after this item is used.' }, 409)
  }
  if (category !== 'material') {
    const configured = await env.DB.prepare(`
      SELECT reagents.item_id
      FROM test_reagents AS reagents
      JOIN tests ON tests.id = reagents.test_id
      WHERE reagents.item_id = ? AND tests.archived_at IS NULL
      LIMIT 1
    `).bind(itemId).first()
    if (configured) return jsonResponse({ error: 'An item used as an active test reagent must remain a material.' }, 409)
  }
  const duplicate = await env.DB.prepare(`
    SELECT id FROM inventory_items WHERE normalized_name = ? AND id <> ?
  `).bind(name.toLowerCase(), itemId).first()
  if (duplicate) return jsonResponse({ error: 'An inventory item with this name already exists.' }, 409)

  const now = new Date().toISOString()
  try {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE inventory_items
        SET name = ?, normalized_name = ?, category = ?, unit = ?,
            threshold_hundredths = ?, updated_at = ?
        WHERE id = ? AND archived_at IS NULL
      `).bind(name, name.toLowerCase(), category, unit, threshold, now, itemId),
      env.DB.prepare(`
        INSERT INTO audit_events (
          id, actor_user_id, action, entity_type, entity_id, details_json, created_at
        )
        SELECT ?, ?, 'inventory_item_updated', 'inventory_item', ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM inventory_items WHERE id = ? AND archived_at IS NULL)
      `).bind(
        crypto.randomUUID(),
        user.id,
        itemId,
        JSON.stringify({ category, unit }),
        now,
        itemId,
      ),
    ])
  } catch (error) {
    if (String(error).toLowerCase().includes('inventory_items.normalized_name')) {
      return jsonResponse({ error: 'An inventory item with this name already exists.' }, 409)
    }
    throw error
  }
  const updated = await env.DB.prepare(`
    SELECT
      items.id,
      items.name,
      items.category,
      items.unit,
      items.threshold_hundredths,
      items.current_stock_hundredths,
      items.created_at,
      items.archived_at,
      COALESCE((
        SELECT SUM(bills.quantity_hundredths)
        FROM import_bills AS bills
        WHERE bills.item_id = items.id
      ), 0) AS imported_hundredths,
      COALESCE((
        SELECT SUM(bills.total_cost_paise)
        FROM import_bills AS bills
        WHERE bills.item_id = items.id
      ), 0) AS expenditure_paise
    FROM inventory_items AS items
    WHERE items.id = ? AND items.archived_at IS NULL
  `).bind(itemId).first<InventoryItemRow>()
  if (!updated) return jsonResponse({ error: 'Inventory item not found.' }, 404)
  return jsonResponse({ item: itemResponse(updated) })
}

async function archiveItem(
  env: AuthEnv,
  user: AuthenticatedUser,
  itemId: string,
): Promise<Response> {
  const activeReagent = await env.DB.prepare(`
    SELECT reagents.item_id
    FROM test_reagents AS reagents
    JOIN tests ON tests.id = reagents.test_id
    WHERE reagents.item_id = ? AND tests.archived_at IS NULL
    LIMIT 1
  `).bind(itemId).first()
  if (activeReagent) return jsonResponse({ error: 'Archive tests using this item before archiving the reagent.' }, 409)

  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE inventory_items
      SET archived_at = ?, updated_at = ?
      WHERE id = ? AND archived_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM test_reagents AS reagents
          JOIN tests ON tests.id = reagents.test_id
          WHERE reagents.item_id = ? AND tests.archived_at IS NULL
        )
    `).bind(now, now, itemId, itemId),
    env.DB.prepare(`
      INSERT INTO audit_events (
        id, actor_user_id, action, entity_type, entity_id, created_at
      )
      SELECT ?, ?, 'inventory_item_archived', 'inventory_item', ?, ?
      WHERE EXISTS (
        SELECT 1 FROM inventory_items WHERE id = ? AND archived_at = ?
      )
    `).bind(crypto.randomUUID(), user.id, itemId, now, itemId, now),
  ])
  const item = await env.DB.prepare(`
    SELECT id, archived_at FROM inventory_items WHERE id = ?
  `).bind(itemId).first<{ id: string; archived_at: string | null }>()
  if (!item) return jsonResponse({ error: 'Inventory item not found.' }, 404)
  if (!item.archived_at) return jsonResponse({ error: 'Archive tests using this item before archiving the reagent.' }, 409)
  return jsonResponse({ itemId, archivedAt: item.archived_at })
}

async function listMovements(request: Request, env: AuthEnv, itemId: string): Promise<Response> {
  const exists = await env.DB.prepare(`
    SELECT id FROM inventory_items WHERE id = ?
  `).bind(itemId).first()
  if (!exists) return jsonResponse({ error: 'Inventory item not found.' }, 404)
  const url = new URL(request.url)
  const limitValue = url.searchParams.get('limit')
  const offsetValue = url.searchParams.get('offset')
  const limit = limitValue === null ? 50 : Number(limitValue)
  const offset = offsetValue === null ? 0 : Number(offsetValue)
  if (
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isInteger(offset) || offset < 0 || offset > 10_000
  ) {
    return jsonResponse({ error: 'Invalid stock history pagination.' }, 400)
  }
  const rows = await env.DB.prepare(`
    SELECT id, source_type, source_id, quantity_delta_hundredths, created_at
    FROM stock_movements
    WHERE item_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).bind(itemId, limit + 1, offset).all<InventoryMovementRow>()
  const hasMore = rows.results.length > limit
  return jsonResponse({
    movements: rows.results.slice(0, limit).map((movement) => ({
      id: movement.id,
      sourceType: movement.source_type,
      sourceId: movement.source_id,
      quantityDelta: movement.quantity_delta_hundredths / 100,
      createdAt: movement.created_at,
    })),
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  })
}

async function recordImport(request: Request, env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const body = await readJson(request, 8_192)
  const itemId = body?.itemId
  const supplierName = typeof body?.supplierName === 'string' ? body.supplierName.trim() : ''
  const quantity = scaledValue(body?.quantity, false)
  const costPerUnit = scaledValue(body?.costPerUnit, true)
  const amountPaid = scaledValue(body?.amountPaid, true)
  const paymentMethod = body?.paymentMethod
  const date = body?.date
  if (
    typeof itemId !== 'string' || !itemId.trim() || itemId.length > 128 ||
    !supplierName || supplierName.length > 160 ||
    quantity === null || costPerUnit === null || amountPaid === null ||
    typeof paymentMethod !== 'string' || !paymentMethods.has(paymentMethod) ||
    typeof date !== 'string' || !isIsoDate(date) || date > labToday()
  ) {
    return jsonResponse({ error: 'Enter a valid item, supplier, quantity, cost, payment, and purchase date.' }, 400)
  }
  const costProduct = quantity * costPerUnit
  if (!Number.isSafeInteger(costProduct)) {
    return jsonResponse({ error: 'The import amount is outside the supported range.' }, 400)
  }
  const totalCost = Math.round(costProduct / 100)
  if (!Number.isSafeInteger(totalCost) || amountPaid > totalCost) {
    return jsonResponse({ error: 'Amount paid cannot exceed the import bill total.' }, 400)
  }
  const item = await env.DB.prepare(`
    SELECT id, name, unit FROM inventory_items WHERE id = ? AND archived_at IS NULL
  `).bind(itemId).first<{
    id: string
    name: string
    unit: 'quantity' | 'kg' | 'litre'
  }>()
  if (!item) return jsonResponse({ error: 'Inventory item not found.' }, 404)

  const billId = `BILL-${crypto.randomUUID()}`
  const paymentId = amountPaid > 0 ? `PAY-${crypto.randomUUID()}` : null
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO import_bills (
        id, item_id, item_name, supplier_name, quantity_hundredths, unit,
        cost_per_unit_paise, total_cost_paise, purchase_date, created_by_user_id, created_at
      )
      SELECT ?, items.id, items.name, ?, ?, items.unit, ?, ?, ?, ?, ?
      FROM inventory_items AS items
      WHERE items.id = ? AND items.archived_at IS NULL
    `).bind(
      billId,
      supplierName,
      quantity,
      costPerUnit,
      totalCost,
      date,
      user.id,
      now,
      item.id,
    ),
    env.DB.prepare(`
      INSERT INTO stock_movements (
        id, item_id, source_type, source_id, quantity_delta_hundredths,
        created_by_user_id, created_at
      )
      SELECT ?, bills.item_id, 'import', bills.id, ?, ?, ?
      FROM import_bills AS bills
      WHERE bills.id = ? AND bills.item_id = ?
    `).bind(`${billId}:stock`, quantity, user.id, now, billId, item.id),
  ]
  if (amountPaid > 0) {
    statements.push(env.DB.prepare(`
      INSERT INTO bill_payments (id, bill_id, amount_paise, method, paid_at, created_by_user_id)
      SELECT ?, id, ?, ?, ?, ?
      FROM import_bills WHERE id = ?
    `).bind(paymentId, amountPaid, paymentMethod, now, user.id, billId))
  }
  statements.push(env.DB.prepare(`
    INSERT INTO audit_events (
      id, actor_user_id, action, entity_type, entity_id, details_json, created_at
    )
    SELECT ?, ?, 'inventory_import_recorded', 'import_bill', ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM import_bills WHERE id = ?)
  `).bind(
    crypto.randomUUID(),
    user.id,
    billId,
    JSON.stringify({ quantityHundredths: quantity, totalCostPaise: totalCost }),
    now,
    billId,
  ))
  try {
    await env.DB.batch(statements)
  } catch (error) {
    if (String(error).toLowerCase().includes('inventory item is unavailable')) {
      return jsonResponse({ error: 'The inventory item was archived before the import completed.' }, 409)
    }
    throw error
  }
  const bill = await env.DB.prepare(`
    SELECT id FROM import_bills WHERE id = ?
  `).bind(billId).first<{ id: string }>()
  if (!bill) return jsonResponse({ error: 'Inventory item changed. Refresh and try again.' }, 409)

  return jsonResponse({
    bill: {
      id: billId,
      itemId: item.id,
      itemName: item.name,
      supplierName,
      quantity: quantity / 100,
      unit: item.unit,
      costPerUnit: costPerUnit / 100,
      totalCost: totalCost / 100,
      payments: paymentId
        ? [{ id: paymentId, amount: amountPaid / 100, paidAt: now, method: paymentMethod }]
        : [],
      date,
      createdAt: now,
    },
  }, 201)
}

async function recordPayment(
  request: Request,
  env: AuthEnv,
  user: AuthenticatedUser,
  billId: string,
): Promise<Response> {
  const body = await readJson(request, 2_048)
  const amount = scaledValue(body?.amount, false)
  const method = body?.method
  if (amount === null || typeof method !== 'string' || !paymentMethods.has(method)) {
    return jsonResponse({ error: 'Enter a positive payment amount and choose Cash or UPI.' }, 400)
  }
  const bill = await env.DB.prepare(`
    SELECT
      bills.total_cost_paise,
      COALESCE((SELECT SUM(payments.amount_paise)
        FROM bill_payments AS payments WHERE payments.bill_id = bills.id), 0) AS paid_paise
    FROM import_bills AS bills
    WHERE bills.id = ?
  `).bind(billId).first<{ total_cost_paise: number; paid_paise: number }>()
  if (!bill) return jsonResponse({ error: 'Import bill not found.' }, 404)
  if (amount > bill.total_cost_paise - bill.paid_paise) {
    return jsonResponse({ error: 'Payment cannot exceed the remaining bill balance.' }, 409)
  }

  const paymentId = `PAY-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const paymentInsert = env.DB.prepare(`
    INSERT INTO bill_payments (id, bill_id, amount_paise, method, paid_at, created_by_user_id)
    SELECT ?, bills.id, ?, ?, ?, ?
    FROM import_bills AS bills
    WHERE bills.id = ?
      AND ? <= bills.total_cost_paise - COALESCE((
        SELECT SUM(payments.amount_paise)
        FROM bill_payments AS payments
        WHERE payments.bill_id = bills.id
      ), 0)
  `).bind(paymentId, amount, method, now, user.id, billId, amount)
  await env.DB.batch([
    paymentInsert,
    env.DB.prepare(`
      INSERT INTO audit_events (
        id, actor_user_id, action, entity_type, entity_id, details_json, created_at
      )
      SELECT ?, ?, 'import_bill_payment_recorded', 'import_bill', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM bill_payments WHERE id = ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      billId,
      JSON.stringify({ amountPaise: amount, method }),
      now,
      paymentId,
    ),
  ])
  const payment = await env.DB.prepare(`
    SELECT id FROM bill_payments WHERE id = ?
  `).bind(paymentId).first<{ id: string }>()
  if (!payment) return jsonResponse({ error: 'The bill balance changed. Refresh and try again.' }, 409)
  return jsonResponse({
    payment: { id: paymentId, billId, amount: amount / 100, method, paidAt: now },
  }, 201)
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

export async function handleInventoryRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const itemsPath = url.pathname === '/api/inventory/items'
  const movementsMatch = url.pathname.match(/^\/api\/inventory\/items\/([^/]+)\/movements$/)
  const itemMatch = url.pathname.match(/^\/api\/inventory\/items\/([^/]+)$/)
  const billsPath = url.pathname === '/api/import-bills'
  const paymentMatch = url.pathname.match(/^\/api\/import-bills\/([^/]+)\/payments$/)
  if (!itemsPath && !movementsMatch && !itemMatch && !billsPath && !paymentMatch) return null
  if (itemsPath && request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed('GET, POST')
  if (movementsMatch && request.method !== 'GET') return methodNotAllowed('GET')
  if (itemMatch && request.method !== 'PATCH' && request.method !== 'DELETE') return methodNotAllowed('PATCH, DELETE')
  if (billsPath && request.method !== 'GET' && request.method !== 'POST') return methodNotAllowed('GET, POST')
  if (paymentMatch && request.method !== 'POST') return methodNotAllowed('POST')

  try {
    const authorization = await authorizeRequest(request, env, managerRoles)
    if ('response' in authorization) return authorization.response
    const user = authorization.user
    if (itemsPath) {
      return request.method === 'GET'
        ? await listItems(request, env)
        : await createItem(request, env, user)
    }
    if (movementsMatch) {
      const itemId = decodePathId(movementsMatch[1])
      return itemId
        ? await listMovements(request, env, itemId)
        : jsonResponse({ error: 'Invalid inventory item ID.' }, 400)
    }
    if (itemMatch) {
      const itemId = decodePathId(itemMatch[1])
      if (!itemId) return jsonResponse({ error: 'Invalid inventory item ID.' }, 400)
      return request.method === 'PATCH'
        ? await updateItem(request, env, user, itemId)
        : await archiveItem(env, user, itemId)
    }
    if (billsPath) {
      return request.method === 'GET'
        ? await listBills(request, env)
        : await recordImport(request, env, user)
    }
    if (paymentMatch) {
      const billId = decodePathId(paymentMatch[1])
      return billId
        ? await recordPayment(request, env, user, billId)
        : jsonResponse({ error: 'Invalid import bill ID.' }, 400)
    }
    return null
  } catch (error) {
    console.error('Unable to process an inventory API request.', error)
    return jsonResponse({ error: 'Unable to process this request.' }, 500)
  }
}

async function listBills(request: Request, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url)
  const itemName = url.searchParams.get('item')?.trim() ?? ''
  const supplier = url.searchParams.get('supplier')?.trim() ?? ''
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const status = url.searchParams.get('status') ?? 'all'
  const limitValue = url.searchParams.get('limit')
  const offsetValue = url.searchParams.get('offset')
  const limit = limitValue === null ? 50 : Number(limitValue)
  const offset = offsetValue === null ? 0 : Number(offsetValue)
  if (
    itemName.length > 100 || supplier.length > 100 ||
    (from && !isIsoDate(from)) || (to && !isIsoDate(to)) ||
    (from && to && from > to) || !paymentStatuses.has(status) ||
    !Number.isInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isInteger(offset) || offset < 0 || offset > 10_000
  ) {
    return jsonResponse({ error: 'Invalid import bill filters or pagination.' }, 400)
  }

  const rows = await env.DB.prepare(`
    WITH bill_balances AS (
      SELECT bills.id, COALESCE(SUM(payments.amount_paise), 0) AS paid_paise
      FROM import_bills AS bills
      LEFT JOIN bill_payments AS payments ON payments.bill_id = bills.id
      GROUP BY bills.id
    )
    SELECT
      bills.id,
      bills.item_id,
      bills.item_name,
      bills.supplier_name,
      bills.quantity_hundredths,
      bills.unit,
      bills.cost_per_unit_paise,
      bills.total_cost_paise,
      bills.purchase_date,
      bills.created_at,
      balances.paid_paise
    FROM import_bills AS bills
    JOIN bill_balances AS balances ON balances.id = bills.id
    WHERE (? = '' OR instr(lower(bills.item_name), lower(?)) > 0)
      AND (? = '' OR instr(lower(bills.supplier_name), lower(?)) > 0)
      AND (? = '' OR bills.purchase_date >= ?)
      AND (? = '' OR bills.purchase_date <= ?)
      AND (? = 'all' OR CASE
        WHEN balances.paid_paise >= bills.total_cost_paise THEN 'paid'
        WHEN balances.paid_paise > 0 THEN 'partially paid'
        ELSE 'unpaid'
      END = ?)
    ORDER BY bills.purchase_date DESC, bills.created_at DESC, bills.id
    LIMIT ? OFFSET ?
  `).bind(
    itemName, itemName, supplier, supplier, from, from, to, to, status, status, limit + 1, offset,
  ).all<ImportBillRow>()
  const hasMore = rows.results.length > limit
  const page = rows.results.slice(0, limit)
  if (!page.length) {
    return jsonResponse({
      bills: [],
      pagination: { limit, offset, hasMore: false, nextOffset: null },
    })
  }
  const placeholders = page.map(() => '?').join(', ')
  const payments = await env.DB.prepare(`
    SELECT id, bill_id, amount_paise, method, paid_at
    FROM bill_payments
    WHERE bill_id IN (${placeholders})
    ORDER BY paid_at, id
  `).bind(...page.map((bill) => bill.id)).all<BillPaymentRow>()
  return jsonResponse({
    bills: page.map((bill) => billResponse(bill, payments.results)),
    pagination: { limit, offset, hasMore, nextOffset: hasMore ? offset + limit : null },
  })
}
