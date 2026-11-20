import { requestApiJson } from '@/services/apiClient'
import type {
  BillPayment,
  ImportBill,
  PaymentMethod,
  StoreExpenditureData,
  StoreItem,
} from '@/features/store-expenditure/types'

type NewItem = Pick<StoreItem, 'name' | 'category' | 'unit' | 'threshold'>
type ItemUpdate = NewItem
type NewImport = {
  itemId: string
  supplierName: string
  quantity: number
  costPerUnit: number
  amountPaid: number
  paymentMethod: PaymentMethod
  date: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): never {
  throw new Error('The server returned invalid inventory data.')
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

function parseItem(value: unknown): StoreItem {
  if (!isRecord(value)) return invalidResponse()
  const category = value.category
  const unit = value.unit
  if ((category !== 'equipment' && category !== 'material') ||
    (unit !== 'quantity' && unit !== 'kg' && unit !== 'litre')) {
    return invalidResponse()
  }
  return {
    id: readString(value.id),
    name: readString(value.name),
    category,
    unit,
    threshold: readNumber(value.threshold),
    currentStock: readNumber(value.currentStock),
    createdAt: readString(value.createdAt),
  }
}

function parsePayment(value: unknown): BillPayment {
  if (!isRecord(value)) return invalidResponse()
  const method = value.method
  if (method !== 'cash' && method !== 'upi' && method !== 'unspecified') return invalidResponse()
  return {
    id: readString(value.id),
    amount: readNumber(value.amount),
    paidAt: readString(value.paidAt),
    method,
  }
}

function parseBill(value: unknown): ImportBill {
  if (!isRecord(value)) return invalidResponse()
  const itemId = value.itemId
  const unit = value.unit
  if (!(itemId === null || typeof itemId === 'string') ||
    (unit !== 'quantity' && unit !== 'kg' && unit !== 'litre')) {
    return invalidResponse()
  }
  return {
    id: readString(value.id),
    itemId,
    itemName: readString(value.itemName),
    supplierName: readString(value.supplierName),
    quantity: readNumber(value.quantity),
    unit,
    costPerUnit: readNumber(value.costPerUnit),
    totalCost: readNumber(value.totalCost),
    payments: readArray(value.payments).map(parsePayment),
    date: readString(value.date),
    createdAt: readString(value.createdAt),
  }
}

function parseItems(value: unknown): StoreItem[] {
  if (!isRecord(value)) return invalidResponse()
  return readArray(value.items).map(parseItem)
}

type BillPage = { bills: ImportBill[]; hasMore: boolean; nextOffset: number | null }

function parseBillPage(value: unknown): BillPage {
  if (!isRecord(value) || !isRecord(value.pagination)) return invalidResponse()
  const pagination = value.pagination
  const nextOffset = pagination.nextOffset
  if (typeof pagination.hasMore !== 'boolean' ||
    !(nextOffset === null || (typeof nextOffset === 'number' && Number.isInteger(nextOffset)))) {
    return invalidResponse()
  }
  return {
    bills: readArray(value.bills).map(parseBill),
    hasMore: pagination.hasMore,
    nextOffset,
  }
}

function parseItemResponse(value: unknown): StoreItem {
  if (!isRecord(value)) return invalidResponse()
  return parseItem(value.item)
}

function parseBillResponse(value: unknown): ImportBill {
  if (!isRecord(value)) return invalidResponse()
  return parseBill(value.bill)
}

function parsePaymentResponse(value: unknown): { id: string; billId: string; amount: number; method: PaymentMethod; paidAt: string } {
  if (!isRecord(value) || !isRecord(value.payment)) return invalidResponse()
  const payment = value.payment
  if (payment.method !== 'cash' && payment.method !== 'upi') return invalidResponse()
  return {
    id: readString(payment.id),
    billId: readString(payment.billId),
    amount: readNumber(payment.amount),
    method: payment.method,
    paidAt: readString(payment.paidAt),
  }
}

function parseArchiveResponse(value: unknown): { itemId: string } {
  if (!isRecord(value)) return invalidResponse()
  return { itemId: readString(value.itemId) }
}

const emptyData: StoreExpenditureData = { items: [], bills: [] }

class ApiStoreExpenditureService {
  private snapshot = emptyData
  private listeners = new Set<() => void>()
  private loaded = false
  private loading: Promise<void> | null = null

  getSnapshot = () => this.snapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  isLoaded() {
    return this.loaded
  }

  load(force = false): Promise<void> {
    if (this.loading) return this.loading
    if (this.loaded && !force) return Promise.resolve()
    this.loading = this.fetchData()
      .then((data) => {
        this.snapshot = data
        this.loaded = true
        this.emit()
      })
      .finally(() => {
        this.loading = null
      })
    return this.loading
  }

  async addItem(draft: NewItem): Promise<void> {
    const item = await requestApiJson('/api/inventory/items', parseItemResponse, {
      method: 'POST',
      body: draft,
    })
    this.commit({ ...this.snapshot, items: [...this.snapshot.items, item] })
  }

  async updateItem(itemId: string, update: ItemUpdate): Promise<void> {
    const item = await requestApiJson(
      `/api/inventory/items/${encodeURIComponent(itemId)}`,
      parseItemResponse,
      { method: 'PATCH', body: update },
    )
    this.commit({
      ...this.snapshot,
      items: this.snapshot.items.map((current) => current.id === item.id ? item : current),
    })
  }

  async removeItem(itemId: string): Promise<void> {
    const result = await requestApiJson(
      `/api/inventory/items/${encodeURIComponent(itemId)}`,
      parseArchiveResponse,
      { method: 'DELETE' },
    )
    this.commit({ ...this.snapshot, items: this.snapshot.items.filter((item) => item.id !== result.itemId) })
  }

  async recordImport(draft: NewImport): Promise<void> {
    const bill = await requestApiJson('/api/import-bills', parseBillResponse, {
      method: 'POST',
      body: draft,
    })
    this.commit({
      items: this.snapshot.items.map((item) => item.id === bill.itemId
        ? { ...item, currentStock: item.currentStock + bill.quantity }
        : item),
      bills: [...this.snapshot.bills, bill],
    })
  }

  async recordPayment(billId: string, amount: number, method: PaymentMethod): Promise<void> {
    const payment = await requestApiJson(
      `/api/import-bills/${encodeURIComponent(billId)}/payments`,
      parsePaymentResponse,
      { method: 'POST', body: { amount, method } },
    )
    this.commit({
      ...this.snapshot,
      bills: this.snapshot.bills.map((bill) => bill.id === payment.billId
        ? {
            ...bill,
            payments: [...bill.payments, {
              id: payment.id,
              amount: payment.amount,
              method: payment.method,
              paidAt: payment.paidAt,
            }],
          }
        : bill),
    })
  }

  private async fetchData(): Promise<StoreExpenditureData> {
    const [items, bills] = await Promise.all([
      requestApiJson('/api/inventory/items', parseItems),
      this.fetchBills(),
    ])
    return { items, bills }
  }

  private async fetchBills(): Promise<ImportBill[]> {
    const bills: ImportBill[] = []
    let offset = 0
    while (true) {
      const page = await requestApiJson(
        `/api/import-bills?limit=100&offset=${offset}`,
        parseBillPage,
      )
      bills.push(...page.bills)
      if (!page.hasMore) return bills
      if (page.nextOffset === null || page.nextOffset <= offset || page.nextOffset > 10_000) {
        throw new Error('The import bill list exceeds the supported result limit.')
      }
      offset = page.nextOffset
    }
  }

  private commit(data: StoreExpenditureData) {
    this.snapshot = data
    this.emit()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

export const storeExpenditureService = new ApiStoreExpenditureService()
