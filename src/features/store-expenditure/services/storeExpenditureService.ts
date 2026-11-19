import { dateInputValue, makeId } from '@/shared/utils/appUtils'
import type {
  ImportBill,
  BillPayment,
  StoreExpenditureData,
  StoreItem,
  StoreItemCategory,
  StoreUnit,
  StockDeductionResult,
  PaymentMethod,
} from '@/features/store-expenditure/types'
import { StoreExpenditureError } from '@/features/store-expenditure/types'
import { calculateTotalCost, fromScaledInteger, getBillRemaining, normalizeItemName, toScaledInteger } from '@/features/store-expenditure/utils'

const STORAGE_KEY = 'primeaisolution-store-expenditure-v1'

type NewItem = Omit<StoreItem, 'id' | 'createdAt' | 'currentStock'>
type ItemUpdate = Pick<StoreItem, 'name' | 'category' | 'unit' | 'threshold'>
type NewImport = {
  itemId: string
  supplierName: string
  quantity: number
  costPerUnit: number
  amountPaid: number
  paymentMethod: PaymentMethod
  date: string
}

type StoredPayment = Omit<BillPayment, 'method'> & { method?: BillPayment['method'] }
type StoredBill = Omit<ImportBill, 'payments'> & { payments?: StoredPayment[] }
type StoredData = { items: StoreItem[]; bills: StoredBill[] }

export interface StoreExpenditureService {
  getSnapshot: () => StoreExpenditureData
  subscribe: (listener: () => void) => () => void
  addItem: (draft: NewItem) => void
  updateItem: (itemId: string, update: ItemUpdate) => void
  removeItem: (itemId: string) => void
  recordImport: (draft: NewImport) => ImportBill
  recordPayment: (billId: string, amount: number, method: PaymentMethod) => void
  deductStock: (itemId: string, quantity: number) => number
}

function isUnit(value: unknown): value is StoreUnit {
  return value === 'quantity' || value === 'kg' || value === 'litre'
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'cash' || value === 'upi'
}

function isItemCategory(value: unknown): value is StoreItemCategory {
  return value === 'equipment' || value === 'material'
}

function isNonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isPayment(value: unknown): value is StoredPayment {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'amount' in value && isNonNegativeNumber(value.amount) &&
    'paidAt' in value && typeof value.paidAt === 'string' &&
    (!('method' in value) || isPaymentMethod(value.method) || value.method === 'unspecified')
}

function isData(value: unknown): value is StoredData {
  if (typeof value !== 'object' || value === null || !('items' in value) || !('bills' in value)) return false
  const data = value as { items: unknown; bills: unknown }
  if (!Array.isArray(data.items) || !Array.isArray(data.bills)) return false
  const items: unknown[] = data.items
  const bills: unknown[] = data.bills
  return items.every((item) =>
      typeof item === 'object' && item !== null &&
      'id' in item && typeof item.id === 'string' &&
      'name' in item && typeof item.name === 'string' &&
      'category' in item && isItemCategory(item.category) &&
      'unit' in item && isUnit(item.unit) &&
      'threshold' in item && isNonNegativeNumber(item.threshold) &&
      'currentStock' in item && isNonNegativeNumber(item.currentStock) &&
      'createdAt' in item && typeof item.createdAt === 'string',
    ) &&
    bills.every((bill) =>
      typeof bill === 'object' && bill !== null &&
      'id' in bill && typeof bill.id === 'string' &&
      'itemId' in bill && typeof bill.itemId === 'string' &&
      'itemName' in bill && typeof bill.itemName === 'string' &&
      'supplierName' in bill && typeof bill.supplierName === 'string' &&
      'quantity' in bill && typeof bill.quantity === 'number' && Number.isFinite(bill.quantity) && bill.quantity > 0 &&
      'unit' in bill && isUnit(bill.unit) &&
      'costPerUnit' in bill && isNonNegativeNumber(bill.costPerUnit) &&
      'totalCost' in bill && isNonNegativeNumber(bill.totalCost) &&
      'date' in bill && typeof bill.date === 'string' &&
      'createdAt' in bill && typeof bill.createdAt === 'string' &&
      (!('payments' in bill) || (Array.isArray(bill.payments) && bill.payments.every(isPayment))),
    )
}

function migrateData(data: StoredData): StoreExpenditureData {
  const importedByItem = new Map<string, number>()
  for (const bill of data.bills) {
    importedByItem.set(bill.itemId, (importedByItem.get(bill.itemId) ?? 0) + toScaledInteger(bill.quantity))
  }
  return {
    items: data.items.map((item) => ({
      ...item,
      currentStock: fromScaledInteger(Math.min(toScaledInteger(item.currentStock), importedByItem.get(item.id) ?? 0)),
    })),
    bills: data.bills.map((bill) => ({
      ...bill,
      payments: (bill.payments ?? []).map((payment) => ({
        ...payment,
        method: payment.method ?? 'unspecified',
      })),
    })),
  }
}

function validateNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
    throw new StoreExpenditureError('invalid-input', `${label} must be a non-negative number with at most 2 decimal places.`)
  }
}

function validateQuantity(value: number) {
  if (!Number.isFinite(value) || value <= 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) {
    throw new StoreExpenditureError('invalid-input', 'Quantity must be greater than 0 and have at most 2 decimal places.')
  }
}

export class LocalStoreExpenditureService implements StoreExpenditureService {
  private snapshot: StoreExpenditureData
  private listeners = new Set<() => void>()

  constructor(private readonly storage: Storage = localStorage) {
    this.snapshot = this.read()
    window.addEventListener('storage', this.onStorage)
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  addItem(draft: NewItem) {
    const name = normalizeItemName(draft.name)
    if (!name || !isItemCategory(draft.category) || !isUnit(draft.unit)) {
      throw new StoreExpenditureError('invalid-input', 'Enter a name, category, and unit.')
    }
    validateNonNegative(draft.threshold, 'Threshold')
    this.assertUniqueName(name)
    this.commit({
      ...this.snapshot,
      items: [...this.snapshot.items, { ...draft, name, currentStock: 0, id: makeId('item'), createdAt: new Date().toISOString() }],
    })
  }

  updateItem(itemId: string, update: ItemUpdate) {
    const item = this.snapshot.items.find((candidate) => candidate.id === itemId)
    if (!item) throw new StoreExpenditureError('item-not-found', 'This item no longer exists.')
    const name = normalizeItemName(update.name)
    if (!name || !isItemCategory(update.category) || !isUnit(update.unit)) {
      throw new StoreExpenditureError('invalid-input', 'Enter a name, category, and unit.')
    }
    validateNonNegative(update.threshold, 'Threshold')
    this.assertUniqueName(name, itemId)
    if (update.unit !== item.unit && this.snapshot.bills.some((bill) => bill.itemId === itemId)) {
      throw new StoreExpenditureError('invalid-input', 'The unit cannot be changed after an import bill exists.')
    }
    this.commit({
      ...this.snapshot,
      items: this.snapshot.items.map((candidate) => candidate.id === itemId ? { ...candidate, ...update, name } : candidate),
    })
  }

  removeItem(itemId: string) {
    if (!this.snapshot.items.some((item) => item.id === itemId)) {
      throw new StoreExpenditureError('item-not-found', 'This item no longer exists.')
    }
    this.commit({
      ...this.snapshot,
      items: this.snapshot.items.filter((item) => item.id !== itemId),
    })
  }

  recordImport(draft: NewImport) {
    const item = this.snapshot.items.find((candidate) => candidate.id === draft.itemId)
    if (!item) throw new StoreExpenditureError('item-not-found', 'This item no longer exists.')
    const supplierName = draft.supplierName.trim()
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? new Date(`${draft.date}T00:00:00.000Z`) : null
    const isValidDate = parsedDate !== null && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === draft.date
    if (!supplierName || !isValidDate) {
      throw new StoreExpenditureError('invalid-input', 'Supplier and a valid purchase date are required.')
    }
    if (draft.date > dateInputValue()) {
      throw new StoreExpenditureError('invalid-input', 'Purchase date cannot be in the future.')
    }
    validateQuantity(draft.quantity)
    validateNonNegative(draft.costPerUnit, 'Cost per unit')
    validateNonNegative(draft.amountPaid, 'Amount paid')
    const totalCost = calculateTotalCost(draft.quantity, draft.costPerUnit)
    if (toScaledInteger(draft.amountPaid) > toScaledInteger(totalCost)) {
      throw new StoreExpenditureError('invalid-input', 'Amount paid cannot exceed the bill total.')
    }
    const payments: BillPayment[] = draft.amountPaid > 0
      ? [{ id: makeId('payment'), amount: fromScaledInteger(toScaledInteger(draft.amountPaid)), paidAt: new Date().toISOString(), method: draft.paymentMethod }]
      : []
    const bill: ImportBill = {
      id: makeId('bill'),
      itemId: item.id,
      itemName: item.name,
      supplierName,
      quantity: fromScaledInteger(toScaledInteger(draft.quantity)),
      unit: item.unit,
      costPerUnit: fromScaledInteger(toScaledInteger(draft.costPerUnit)),
      totalCost,
      payments,
      date: draft.date,
      createdAt: new Date().toISOString(),
    }
    const nextStock = fromScaledInteger(toScaledInteger(item.currentStock) + toScaledInteger(draft.quantity))
    this.commit({
      items: this.snapshot.items.map((candidate) => candidate.id === item.id ? { ...candidate, currentStock: nextStock } : candidate),
      bills: [...this.snapshot.bills, bill],
    })
    return bill
  }

  recordPayment(billId: string, amount: number, method: PaymentMethod) {
    validateNonNegative(amount, 'Payment')
    if (amount <= 0) throw new StoreExpenditureError('invalid-input', 'Payment must be greater than 0.')
    if (!isPaymentMethod(method)) throw new StoreExpenditureError('invalid-input', 'Choose Cash or UPI as the payment method.')
    const bill = this.snapshot.bills.find((candidate) => candidate.id === billId)
    if (!bill) throw new StoreExpenditureError('bill-not-found', 'This bill no longer exists.')
    const remaining = getBillRemaining(bill)
    if (amount > remaining || toScaledInteger(amount) > toScaledInteger(remaining)) {
      throw new StoreExpenditureError('invalid-input', `Payment cannot exceed the remaining balance of ₹${remaining.toFixed(2)}.`)
    }
    this.commit({
      ...this.snapshot,
      bills: this.snapshot.bills.map((candidate) => candidate.id === billId
        ? { ...candidate, payments: [...candidate.payments, { id: makeId('payment'), amount, paidAt: new Date().toISOString(), method }] }
        : candidate),
    })
  }

  deductStock(itemId: string, quantity: number) {
    validateQuantity(quantity)
    const item = this.snapshot.items.find((candidate) => candidate.id === itemId)
    if (!item) throw new StoreExpenditureError('item-not-found', 'This item no longer exists.')
    const remaining = toScaledInteger(item.currentStock) - toScaledInteger(quantity)
    if (remaining < 0) throw new StoreExpenditureError('insufficient-stock', `Insufficient stock. Only ${item.currentStock} ${item.unit} available.`)
    const remainingStock = fromScaledInteger(remaining)
    this.commit({
      ...this.snapshot,
      items: this.snapshot.items.map((candidate) => candidate.id === itemId ? { ...candidate, currentStock: remainingStock } : candidate),
    })
    return remainingStock
  }

  private assertUniqueName(name: string, exceptId?: string) {
    const normalized = name.toLocaleLowerCase()
    if (this.snapshot.items.some((item) => item.id !== exceptId && item.name.toLocaleLowerCase() === normalized)) {
      throw new StoreExpenditureError('duplicate-name', 'An item with this name already exists.')
    }
  }

  private read(): StoreExpenditureData {
    try {
      const saved = this.storage.getItem(STORAGE_KEY)
      if (!saved) return { items: [], bills: [] }
      const parsed: unknown = JSON.parse(saved)
      if (isData(parsed)) return migrateData(parsed)
      console.error('Saved store and expenditure data has an invalid shape.')
    } catch (error) {
      console.error('Unable to load store and expenditure data.', error)
    }
    return { items: [], bills: [] }
  }

  private commit(next: StoreExpenditureData) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(next))
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }

  private onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    this.snapshot = this.read()
    for (const listener of this.listeners) listener()
  }
}

export const storeExpenditureService = new LocalStoreExpenditureService()

export function deductStock(itemId: string, quantity: number): StockDeductionResult {
  try {
    return { ok: true, remainingStock: storeExpenditureService.deductStock(itemId, quantity) } as const
  } catch (error) {
    if (error instanceof StoreExpenditureError) return { ok: false, error: error.message } as const
    throw error
  }
}
