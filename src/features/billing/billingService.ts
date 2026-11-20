import { requestApiJson } from '@/services/apiClient'
import type {
  BillingInvoice,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from '@/features/billing/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): never {
  throw new Error('The server returned invalid billing data.')
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : invalidResponse()
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalidResponse()
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalidResponse()
}

function parseInvoice(value: unknown): BillingInvoice {
  if (!isRecord(value) || !Array.isArray(value.items)) return invalidResponse()
  const status = value.status
  const paymentMethod = value.paymentMethod
  if ((status !== 'Paid' && status !== 'Unpaid') ||
    (paymentMethod !== '' && paymentMethod !== 'Cash' && paymentMethod !== 'Online')) {
    return invalidResponse()
  }
  const items = readArray(value.items).map((item) => {
    if (!isRecord(item) || !(item.testId === null || typeof item.testId === 'string')) {
      return invalidResponse()
    }
    return {
      testId: item.testId,
      name: readString(item.name),
      amount: readNumber(item.amount),
    }
  })
  return {
    id: readString(value.id),
    patientId: readString(value.patientId),
    patientName: readString(value.patientName),
    patientPhone: readString(value.patientPhone),
    items,
    discount: readNumber(value.discount),
    amount: readNumber(value.amount),
    status,
    paymentMethod,
    date: readString(value.date),
  }
}

type InvoicePage = { invoices: BillingInvoice[]; hasMore: boolean; nextOffset: number | null }

function parseInvoicePage(value: unknown): InvoicePage {
  if (!isRecord(value) || !isRecord(value.pagination)) return invalidResponse()
  const pagination = value.pagination
  const nextOffset = pagination.nextOffset
  if (typeof pagination.hasMore !== 'boolean' ||
    !(nextOffset === null || (typeof nextOffset === 'number' && Number.isInteger(nextOffset)))) {
    return invalidResponse()
  }
  return {
    invoices: readArray(value.invoices).map(parseInvoice),
    hasMore: pagination.hasMore,
    nextOffset,
  }
}

function parseInvoiceResponse(value: unknown): BillingInvoice {
  if (!isRecord(value)) return invalidResponse()
  return parseInvoice(value.invoice)
}

export async function listInvoices(): Promise<BillingInvoice[]> {
  const invoices: BillingInvoice[] = []
  let offset = 0
  while (true) {
    const page = await requestApiJson(`/api/invoices?limit=100&offset=${offset}`, parseInvoicePage)
    invoices.push(...page.invoices)
    if (!page.hasMore) return invoices
    if (page.nextOffset === null || page.nextOffset <= offset || page.nextOffset > 10_000) {
      throw new Error('The invoice list exceeds the supported result limit.')
    }
    offset = page.nextOffset
  }
}

export function createInvoice(input: {
  patientId: string
  testIds: string[]
  discount: number
  status: BillingPaymentStatus
  paymentMethod: BillingPaymentMethod
  date: string
}): Promise<BillingInvoice> {
  return requestApiJson('/api/invoices', parseInvoiceResponse, { method: 'POST', body: input })
}

export function updateInvoicePayment(
  invoiceId: string,
  status: BillingPaymentStatus,
  paymentMethod: BillingPaymentMethod,
): Promise<BillingInvoice> {
  return requestApiJson(
    `/api/invoices/${encodeURIComponent(invoiceId)}`,
    parseInvoiceResponse,
    { method: 'PATCH', body: { status, paymentMethod } },
  )
}
