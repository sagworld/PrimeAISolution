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
}

export type BillPaymentStatus = 'paid' | 'partially paid' | 'unpaid'
export type BillStatusFilter = 'all' | BillPaymentStatus

export type ImportBill = {
  id: string
  itemId: string
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
  deductedOrderIds: string[]
}

export type InventoryRow = StoreItem & { usedQuantity: number; totalExpenditure: number }

export type StockDeductionResult =
  | { ok: true; remainingStock: number }
  | { ok: false; error: string }

export type StoreExpenditureErrorCode =
  | 'invalid-input'
  | 'duplicate-name'
  | 'item-not-found'
  | 'insufficient-stock'
  | 'bill-not-found'

export class StoreExpenditureError extends Error {
  constructor(
    public readonly code: StoreExpenditureErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'StoreExpenditureError'
  }
}
