export type BillingPaymentStatus = 'Paid' | 'Unpaid'
export type BillingPaymentMethod = 'Cash' | 'Online' | ''

export type BillingInvoiceItem = {
  testId: string | null
  name: string
  amount: number
}

export type BillingInvoice = {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  items: BillingInvoiceItem[]
  discount: number
  amount: number
  status: BillingPaymentStatus
  paymentMethod: BillingPaymentMethod
  date: string
}

export type BillingData = {
  invoices: BillingInvoice[]
}
