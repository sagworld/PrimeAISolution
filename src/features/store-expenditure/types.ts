export type StoreItemCategory = 'equipment' | 'material'
export type StoreUnit = 'quantity' | 'kg' | 'litre'
export type BillsGroupBy = 'none' | 'material' | 'supplier'

export type StoreItem = {
  id: string
  name: string
  category: StoreItemCategory
  unit: StoreUnit
  threshold: number
  currentStock: number
  createdAt: string
}

export type BillPayment = {
  id: string
  amount: number
  paidAt: string
  method: PaymentMethod | 'unspecified'
}

export type PaymentMethod = 'cash' | 'upi'

export type BillPaymentStatus = 'paid' | 'partially paid' | 'unpaid'
export type BillStatusFilter = 'all' | BillPaymentStatus

export type ImportBill = {
  id: string
  itemId: string | null
  itemName: string
  supplierName: string
  quantity: number
  unit: StoreUnit
  costPerUnit: number
  totalCost: number
  payments: BillPayment[]
  date: string
  createdAt: string
}

export type StoreExpenditureData = {
  items: StoreItem[]
  bills: ImportBill[]
}

export type InventoryRow = StoreItem & { usedQuantity: number; totalExpenditure: number }
