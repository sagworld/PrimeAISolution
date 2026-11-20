import {
  authorizeRequest,
  jsonResponse,
  type AuthEnv,
  type UserRole,
} from './auth'
import { isIsoDate, localDateStartUtc, nextIsoDate } from './dateUtils'

type DateRange = {
  from: string
  to: string
  startAt: string
  endBefore: string
}

type BreakdownRow = {
  id: string
  name: string
  orders: number
  amount_paise: number
}

const managerRoles: readonly UserRole[] = ['owner', 'lab-technician']
const ownerRoles: readonly UserRole[] = ['owner']

function readDateRange(url: URL): DateRange | null {
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return null
  const dayCount = (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000 + 1
  if (dayCount > 366) return null
  return {
    from,
    to,
    startAt: localDateStartUtc(from),
    endBefore: localDateStartUtc(nextIsoDate(to)),
  }
}

function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      allow: 'GET',
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function reportSummary(request: Request, env: AuthEnv): Promise<Response> {
  const range = readDateRange(new URL(request.url))
  if (!range) return jsonResponse({ error: 'Provide a valid report date range of at most 366 days.' }, 400)
  const [totals, categories] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        SUM(CASE WHEN orders.status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN orders.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
        COALESCE(SUM(CASE WHEN tests.price_paise > 0 THEN tests.price_paise ELSE 0 END), 0) AS estimated_revenue_paise,
        SUM(CASE WHEN tests.price_paise <= 0 THEN 1 ELSE 0 END) AS unpriced_order_count
      FROM lab_orders AS orders
      JOIN tests ON tests.id = orders.test_id
      WHERE orders.created_at >= ? AND orders.created_at < ?
    `).bind(range.startAt, range.endBefore).first<{
      order_count: number
      completed_count: number
      pending_count: number
      estimated_revenue_paise: number
      unpriced_order_count: number
    }>(),
    env.DB.prepare(`
      SELECT tests.category, COUNT(*) AS order_count
      FROM lab_orders AS orders
      JOIN tests ON tests.id = orders.test_id
      WHERE orders.created_at >= ? AND orders.created_at < ?
      GROUP BY tests.category
      ORDER BY order_count DESC, tests.category COLLATE NOCASE
    `).bind(range.startAt, range.endBefore).all<{ category: string; order_count: number }>(),
  ])
  return jsonResponse({
    from: range.from,
    to: range.to,
    summary: {
      orderCount: totals?.order_count ?? 0,
      completedCount: totals?.completed_count ?? 0,
      pendingCount: totals?.pending_count ?? 0,
      estimatedRevenuePaise: totals?.estimated_revenue_paise ?? 0,
      unpricedOrderCount: totals?.unpriced_order_count ?? 0,
    },
    categories: categories.results.map((row) => ({
      category: row.category,
      orderCount: row.order_count,
    })),
  })
}

async function revenueBreakdown(
  env: AuthEnv,
  range: DateRange,
  table: 'referrers' | 'lab_technicians' | 'sample_collectors',
  patientColumn: 'referrer_id' | 'lab_technician_id' | 'sample_collector_id',
): Promise<BreakdownRow[]> {
  const rows = await env.DB.prepare(`
    WITH attributed_orders AS (
      SELECT
        people.id AS person_id,
        COUNT(*) AS orders,
        COALESCE(SUM(CASE WHEN tests.price_paise > 0 THEN tests.price_paise ELSE 0 END), 0) AS amount_paise
      FROM lab_orders
      JOIN patients ON patients.id = lab_orders.patient_id
      LEFT JOIN ${table} AS people
        ON people.id = patients.${patientColumn} AND people.archived_at IS NULL
      JOIN tests ON tests.id = lab_orders.test_id
      WHERE lab_orders.created_at >= ? AND lab_orders.created_at < ?
      GROUP BY people.id
    )
    SELECT
      people.id,
      people.name,
      COALESCE(attributed_orders.orders, 0) AS orders,
      COALESCE(attributed_orders.amount_paise, 0) AS amount_paise
    FROM ${table} AS people
    LEFT JOIN attributed_orders ON attributed_orders.person_id = people.id
    WHERE people.archived_at IS NULL
    UNION ALL
    SELECT
      'unassigned',
      'Unassigned',
      attributed_orders.orders,
      attributed_orders.amount_paise
    FROM attributed_orders
    WHERE attributed_orders.person_id IS NULL
    ORDER BY amount_paise DESC, name COLLATE NOCASE
  `).bind(range.startAt, range.endBefore).all<BreakdownRow>()
  return rows.results
}

async function revenueReport(request: Request, env: AuthEnv): Promise<Response> {
  const range = readDateRange(new URL(request.url))
  if (!range) return jsonResponse({ error: 'Provide a valid revenue date range of at most 366 days.' }, 400)
  const [orders, invoices, referrers, technicians, collectors] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(CASE WHEN tests.price_paise > 0 THEN tests.price_paise ELSE 0 END), 0) AS estimated_revenue_paise,
        SUM(CASE WHEN tests.price_paise <= 0 THEN 1 ELSE 0 END) AS unpriced_order_count
      FROM lab_orders AS orders
      JOIN tests ON tests.id = orders.test_id
      WHERE orders.created_at >= ? AND orders.created_at < ?
    `).bind(range.startAt, range.endBefore).first<{
      order_count: number
      estimated_revenue_paise: number
      unpriced_order_count: number
    }>(),
    env.DB.prepare(`
      SELECT
        COUNT(*) AS invoice_count,
        COALESCE(SUM(amount_paise), 0) AS billed_paise,
        SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS paid_invoice_count,
        COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount_paise ELSE 0 END), 0) AS paid_paise,
        SUM(CASE WHEN status = 'Unpaid' THEN 1 ELSE 0 END) AS unpaid_invoice_count,
        COALESCE(SUM(CASE WHEN status = 'Unpaid' THEN amount_paise ELSE 0 END), 0) AS unpaid_paise
      FROM invoices
      WHERE invoice_date >= ? AND invoice_date <= ?
    `).bind(range.from, range.to).first<{
      invoice_count: number
      billed_paise: number
      paid_invoice_count: number
      paid_paise: number
      unpaid_invoice_count: number
      unpaid_paise: number
    }>(),
    revenueBreakdown(env, range, 'referrers', 'referrer_id'),
    revenueBreakdown(env, range, 'lab_technicians', 'lab_technician_id'),
    revenueBreakdown(env, range, 'sample_collectors', 'sample_collector_id'),
  ])
  return jsonResponse({
    from: range.from,
    to: range.to,
    estimatedOrderRevenue: {
      orderCount: orders?.order_count ?? 0,
      amountPaise: orders?.estimated_revenue_paise ?? 0,
      unpricedOrderCount: orders?.unpriced_order_count ?? 0,
    },
    invoices: {
      count: invoices?.invoice_count ?? 0,
      billedPaise: invoices?.billed_paise ?? 0,
      paidCount: invoices?.paid_invoice_count ?? 0,
      paidPaise: invoices?.paid_paise ?? 0,
      unpaidCount: invoices?.unpaid_invoice_count ?? 0,
      unpaidPaise: invoices?.unpaid_paise ?? 0,
    },
    breakdowns: {
      referrers: referrers.map((row) => ({
        id: row.id,
        name: row.name,
        orders: row.orders,
        amount: row.amount_paise / 100,
        amountPaise: row.amount_paise,
      })),
      technicians: technicians.map((row) => ({
        id: row.id,
        name: row.name,
        orders: row.orders,
        amount: row.amount_paise / 100,
        amountPaise: row.amount_paise,
      })),
      collectors: collectors.map((row) => ({
        id: row.id,
        name: row.name,
        orders: row.orders,
        amount: row.amount_paise / 100,
        amountPaise: row.amount_paise,
      })),
    },
    notice: 'Estimated order revenue uses current test prices and is not collected payment or profit.',
  })
}

export async function handleReportRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const url = new URL(request.url)
  const summaryPath = url.pathname === '/api/reports/summary'
  const revenuePath = url.pathname === '/api/revenue'
  if (!summaryPath && !revenuePath) return null
  if (request.method !== 'GET') return methodNotAllowed()

  try {
    const authorization = await authorizeRequest(
      request,
      env,
      revenuePath ? ownerRoles : managerRoles,
    )
    if ('response' in authorization) return authorization.response
    return revenuePath
      ? await revenueReport(request, env)
      : await reportSummary(request, env)
  } catch (error) {
    console.error('Unable to process a report request.', error)
    return jsonResponse({ error: 'Unable to process this request.' }, 500)
  }
}
