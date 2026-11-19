import type {
  BillsGroupBy,
  ImportBill,
  InventoryRow,
  StoreExpenditureData,
  StoreItem,
  StoreUnit,
  BillPaymentStatus,
  BillStatusFilter,
} from '@/features/store-expenditure/types'

const QUANTITY_SCALE = 100

export function toScaledInteger(value: number) {
  return Math.round((value + Number.EPSILON) * QUANTITY_SCALE)
}

export function fromScaledInteger(value: number) {
  return value / QUANTITY_SCALE
}

export function calculateTotalCost(quantity: number, costPerUnit: number) {
  const quantityHundredths = toScaledInteger(quantity)
  const costPerUnitMinor = toScaledInteger(costPerUnit)
  return fromScaledInteger(Math.round((quantityHundredths * costPerUnitMinor) / QUANTITY_SCALE))
}

export function getInventoryRows(data: StoreExpenditureData): InventoryRow[] {
  const expenditureByItem = new Map<string, number>()
  const importedQuantityByItem = new Map<string, number>()
  for (const bill of data.bills) {
    expenditureByItem.set(
      bill.itemId,
      (expenditureByItem.get(bill.itemId) ?? 0) + toScaledInteger(bill.totalCost),
    )
    importedQuantityByItem.set(
      bill.itemId,
      (importedQuantityByItem.get(bill.itemId) ?? 0) + toScaledInteger(bill.quantity),
    )
  }
  return data.items.map((item) => {
    const importedQuantity = importedQuantityByItem.get(item.id) ?? 0
    return {
      ...item,
      usedQuantity: fromScaledInteger(Math.max(0, importedQuantity - toScaledInteger(item.currentStock))),
      totalExpenditure: fromScaledInteger(expenditureByItem.get(item.id) ?? 0),
    }
  })
}

export function filterInventory(items: InventoryRow[], search: string, lowStockOnly: boolean) {
  const query = search.trim().toLocaleLowerCase()
  return items.filter((item) =>
    (!query || item.name.toLocaleLowerCase().includes(query)) &&
    (!lowStockOnly || item.currentStock < item.threshold),
  )
}

export function filterImportBills(
  bills: ImportBill[],
  filters: { itemName: string; supplierName: string; from: string; to: string; status: BillStatusFilter },
) {
  const itemQuery = filters.itemName.trim().toLocaleLowerCase()
  const supplierQuery = filters.supplierName.trim().toLocaleLowerCase()
  return bills
    .filter((bill) =>
      (!itemQuery || bill.itemName.toLocaleLowerCase().includes(itemQuery)) &&
      (!supplierQuery || bill.supplierName.toLocaleLowerCase().includes(supplierQuery)) &&
      (!filters.from || bill.date >= filters.from) &&
      (!filters.to || bill.date <= filters.to) &&
      (filters.status === 'all' || getBillPaymentStatus(bill) === filters.status),
    )
    .sort((first, second) => second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt))
}

export type BillGroup = {
  key: string
  label: string
  bills: ImportBill[]
  totalCost: number
  totalPaid: number
  remaining: number
  quantity: number | null
  unit: StoreUnit | null
}

export function getBillPaidAmount(bill: ImportBill) {
  return fromScaledInteger(bill.payments.reduce((sum, payment) => sum + toScaledInteger(payment.amount), 0))
}

export function getBillRemaining(bill: ImportBill) {
  return fromScaledInteger(Math.max(0, toScaledInteger(bill.totalCost) - toScaledInteger(getBillPaidAmount(bill))))
}

export function getBillPaymentStatus(bill: ImportBill): BillPaymentStatus {
  const paid = toScaledInteger(getBillPaidAmount(bill))
  const total = toScaledInteger(bill.totalCost)
  if (paid >= total) return 'paid'
  return paid > 0 ? 'partially paid' : 'unpaid'
}

export function groupImportBills(bills: ImportBill[], groupBy: BillsGroupBy): BillGroup[] {
  const grouped = new Map<string, ImportBill[]>()
  for (const bill of bills) {
    const label = groupBy === 'material' ? bill.itemName : bill.supplierName
    const rows = grouped.get(label) ?? []
    rows.push(bill)
    grouped.set(label, rows)
  }
  return [...grouped.entries()].map(([label, rows]) => {
    const units = new Set(rows.map((bill) => bill.unit))
    return {
      key: label,
      label,
      bills: rows,
      totalCost: fromScaledInteger(rows.reduce((sum, bill) => sum + toScaledInteger(bill.totalCost), 0)),
      totalPaid: fromScaledInteger(rows.reduce((sum, bill) => sum + toScaledInteger(getBillPaidAmount(bill)), 0)),
      remaining: fromScaledInteger(rows.reduce((sum, bill) => sum + toScaledInteger(getBillRemaining(bill)), 0)),
      quantity: units.size === 1 ? fromScaledInteger(rows.reduce((sum, bill) => sum + toScaledInteger(bill.quantity), 0)) : null,
      unit: units.size === 1 ? rows[0].unit : null,
    }
  }).sort((first, second) => first.label.localeCompare(second.label))
}

export function getBillTotals(bills: ImportBill[]) {
  const units = new Set(bills.map((bill) => bill.unit))
  return {
    totalCost: fromScaledInteger(bills.reduce((sum, bill) => sum + toScaledInteger(bill.totalCost), 0)),
    totalPaid: fromScaledInteger(bills.reduce((sum, bill) => sum + toScaledInteger(getBillPaidAmount(bill)), 0)),
    remaining: fromScaledInteger(bills.reduce((sum, bill) => sum + toScaledInteger(getBillRemaining(bill)), 0)),
    quantity: units.size === 1
      ? fromScaledInteger(bills.reduce((sum, bill) => sum + toScaledInteger(bill.quantity), 0))
      : null,
    unit: units.size === 1 ? bills[0]?.unit ?? null : null,
  }
}

export function getSuppliers(data: StoreExpenditureData) {
  return [...new Set(data.bills.map((bill) => bill.supplierName))].sort((a, b) => a.localeCompare(b))
}

export function getItemNames(data: StoreExpenditureData) {
  return [...new Set(data.bills.map((bill) => bill.itemName))].sort((a, b) => a.localeCompare(b))
}

export function formatStoreCurrency(amount: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function unitLabel(unit: StoreUnit) {
  return unit === 'quantity' ? 'qty' : unit
}

export function normalizeItemName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function hasBillsForItem(data: StoreExpenditureData, item: StoreItem) {
  return data.bills.some((bill) => bill.itemId === item.id)
}
