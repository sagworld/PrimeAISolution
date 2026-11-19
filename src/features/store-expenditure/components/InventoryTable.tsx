import { Icon } from '@/shared/components/Icon'
import { formatStoreCurrency, unitLabel } from '@/features/store-expenditure/utils'
import { StockStatusBadge } from '@/features/store-expenditure/components/StockStatusBadge'
import { TableTotalRow } from '@/features/store-expenditure/components/TableTotalRow'
import type { InventoryRow } from '@/features/store-expenditure/types'

export function InventoryTable({
  items,
  totalExpenditure,
  locale,
  search,
  lowStockOnly,
  onSearchChange,
  onLowStockChange,
  onAdd,
  onImport,
  onEdit,
}: {
  items: InventoryRow[]
  totalExpenditure: number
  locale: string
  search: string
  lowStockOnly: boolean
  onSearchChange: (value: string) => void
  onLowStockChange: (value: boolean) => void
  onAdd: () => void
  onImport: (item: InventoryRow) => void
  onEdit: (item: InventoryRow) => void
}) {
  return (
    <div className="panel store-panel">
      <div className="list-toolbar">
        <div><h2>Inventory</h2><p>Equipment and materials currently in store.</p></div>
        <div className="store-toolbar-actions">
          <label className="table-search"><Icon name="search" size={16} /><input aria-label="Search inventory by name" placeholder="Search items" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label>
          <label className="store-low-filter"><input type="checkbox" checked={lowStockOnly} onChange={(event) => onLowStockChange(event.target.checked)} /> Low stock only</label>
          <button type="button" className="button button-primary" onClick={onAdd}><Icon name="plus" size={16} /> Add Item</button>
        </div>
      </div>
      <div className="store-table-scroll" role="region" aria-label="Inventory table" tabIndex={0}>
        <table className="store-table store-inventory-table">
          <thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Used quantity</th><th>Remaining stock</th><th>Total expenditure</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((item) => {
              const isLow = item.currentStock < item.threshold
              return <tr key={item.id} className={isLow ? 'store-low-row' : ''}>
                <td><strong>{item.name}</strong></td><td>{item.category}</td><td>{unitLabel(item.unit)}</td>
                <td>{item.usedQuantity.toLocaleString(locale, { maximumFractionDigits: 2 })}</td>
                <td>{item.currentStock.toLocaleString(locale, { maximumFractionDigits: 2 })}</td>
                <td>{formatStoreCurrency(item.totalExpenditure, locale)}</td><td><StockStatusBadge low={isLow} /></td>
                <td><div className="store-row-actions"><button type="button" className="button button-small button-outline" onClick={() => onImport(item)}>Import</button><button type="button" className="button button-small button-outline" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}>Edit</button></div></td>
              </tr>
            })}
            {!items.length && <tr><td className="empty-cell" colSpan={8}>No inventory items match these filters.</td></tr>}
          </tbody>
          <TableTotalRow cells={['Total', '—', '—', '—', '—', formatStoreCurrency(totalExpenditure, locale), '—', '—']} />
        </table>
      </div>
    </div>
  )
}
