import type { BillStatusFilter, BillsGroupBy } from '@/features/store-expenditure/types'

export function BillFilters({
  itemName,
  supplierName,
  from,
  to,
  itemNames,
  suppliers,
  groupBy,
  status,
  onItemNameChange,
  onSupplierChange,
  onFromChange,
  onToChange,
  onGroupByChange,
  onStatusChange,
  onClear,
}: {
  itemName: string
  supplierName: string
  from: string
  to: string
  itemNames: string[]
  suppliers: string[]
  groupBy: BillsGroupBy
  status: BillStatusFilter
  onItemNameChange: (value: string) => void
  onSupplierChange: (value: string) => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onGroupByChange: (value: BillsGroupBy) => void
  onStatusChange: (value: BillStatusFilter) => void
  onClear: () => void
}) {
  return (
    <div className="store-bill-filters">
      <label>Item<input aria-label="Filter bills by item" list="store-item-options" value={itemName} onChange={(event) => onItemNameChange(event.target.value)} placeholder="All items" /><datalist id="store-item-options">{itemNames.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label>Supplier<input aria-label="Filter bills by supplier" list="store-bill-supplier-options" value={supplierName} onChange={(event) => onSupplierChange(event.target.value)} placeholder="All suppliers" /><datalist id="store-bill-supplier-options">{suppliers.map((name) => <option key={name} value={name} />)}</datalist></label>
      <label>From<input aria-label="Filter bills from date" type="date" value={from} max={to || undefined} onChange={(event) => onFromChange(event.target.value)} /></label>
      <label>To<input aria-label="Filter bills to date" type="date" value={to} min={from || undefined} onChange={(event) => onToChange(event.target.value)} /></label>
      <label>Payment status<select aria-label="Filter bills by payment status" value={status} onChange={(event) => {
        if (event.target.value === 'all' || event.target.value === 'paid' || event.target.value === 'partially paid' || event.target.value === 'unpaid') onStatusChange(event.target.value)
      }}><option value="all">All statuses</option><option value="unpaid">Unpaid</option><option value="partially paid">Partially paid</option><option value="paid">Paid</option></select></label>
      <label>Group by<select aria-label="Group bills by" value={groupBy} onChange={(event) => {
        if (event.target.value === 'none' || event.target.value === 'material' || event.target.value === 'supplier') onGroupByChange(event.target.value)
      }}><option value="none">None</option><option value="material">Item</option><option value="supplier">Supplier</option></select></label>
      <button type="button" className="button button-outline button-small" onClick={onClear}>Clear filters</button>
    </div>
  )
}
