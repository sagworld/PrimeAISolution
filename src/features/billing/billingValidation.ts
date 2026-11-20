import type { BillingPaymentMethod, BillingPaymentStatus } from '@/features/billing/types'

export function isPaymentStatus(value: string): value is BillingPaymentStatus {
  return value === 'Paid' || value === 'Unpaid'
}

export function isPaymentMethod(value: string): value is BillingPaymentMethod {
  return value === '' || value === 'Cash' || value === 'Online'
}
