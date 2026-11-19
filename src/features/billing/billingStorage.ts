import type { BillingData, BillingInvoice, BillingInvoiceItem, BillingPaymentMethod, BillingPaymentStatus } from '@/features/billing/types'

const STORAGE_KEY = 'primeaisolution-billing-v1'

const emptyBillingData: BillingData = { invoices: [], paymentQr: '' }

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isInvoiceItem(value: unknown): value is BillingInvoiceItem {
  if (typeof value !== 'object' || value === null) return false
  return 'testId' in value && typeof value.testId === 'string' &&
    'name' in value && typeof value.name === 'string' &&
    'amount' in value && isNonNegativeNumber(value.amount)
}

function isInvoice(value: unknown): value is BillingInvoice {
  if (typeof value !== 'object' || value === null) return false
  return 'id' in value && typeof value.id === 'string' &&
    'patientId' in value && typeof value.patientId === 'string' &&
    'patientName' in value && typeof value.patientName === 'string' &&
    'patientPhone' in value && typeof value.patientPhone === 'string' &&
    'items' in value && Array.isArray(value.items) && value.items.every(isInvoiceItem) &&
    'discount' in value && isNonNegativeNumber(value.discount) &&
    'amount' in value && isNonNegativeNumber(value.amount) &&
    'status' in value && (value.status === 'Paid' || value.status === 'Unpaid') &&
    'paymentMethod' in value && (value.paymentMethod === '' || value.paymentMethod === 'Cash' || value.paymentMethod === 'Online') &&
    'date' in value && typeof value.date === 'string'
}

function isBillingData(value: unknown): value is BillingData {
  if (typeof value !== 'object' || value === null || !('invoices' in value) || !('paymentQr' in value)) return false
  return Array.isArray(value.invoices) &&
    value.invoices.every(isInvoice) &&
    typeof value.paymentQr === 'string'
}

export function readBillingData(): BillingData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return emptyBillingData
    const parsed: unknown = JSON.parse(saved)
    if (isBillingData(parsed)) return parsed
    console.error('Saved billing data is invalid and could not be loaded.')
  } catch (error) {
    console.error('Unable to load saved billing data.', error)
  }
  return emptyBillingData
}

export function saveBillingData(data: BillingData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Unable to save billing data in this browser.', error)
    throw new Error('Unable to save billing data in this browser.')
  }
}

export function isPaymentStatus(value: string): value is BillingPaymentStatus {
  return value === 'Paid' || value === 'Unpaid'
}

export function isPaymentMethod(value: string): value is BillingPaymentMethod {
  return value === '' || value === 'Cash' || value === 'Online'
}
