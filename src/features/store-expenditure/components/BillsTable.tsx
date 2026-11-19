import { useState } from 'react'
import { BillFilters } from '@/features/store-expenditure/components/BillFilters'
import { TableTotalRow } from '@/features/store-expenditure/components/TableTotalRow'
import { formatStoreCurrency, getBillPaidAmount, getBillPaymentStatus, getBillRemaining, unitLabel } from '@/features/store-expenditure/utils'
import type { BillPaymentStatus, BillStatusFilter, BillsGroupBy, ImportBill, StoreUnit } from '@/features/store-expenditure/types'
import type { BillGroup } from '@/features/store-expenditure/utils'

function PaymentStatus({ status }: { status: BillPaymentStatus }) {
  const label = status === 'partially paid' ? 'Partially paid' : status[0].toUpperCase() + status.slice(1)
  return <span className={`store-payment-status ${status.replace(' ', '-')}`}>{label}</span>
}

function BillRow({ bill, locale, onRecordPayment, onViewBill }: { bill: ImportBill; locale: string; onRecordPayment: (bill: ImportBill) => void; onViewBill: (bill: ImportBill) => void }) {
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${bill.date}T00:00:00`))
  const status = getBillPaymentStatus(bill)
  return <tr><td>{date}</td><td>{bill.itemName}</td><td>{bill.supplierName}</td><td>{bill.quantity.toLocaleString(locale, { maximumFractionDigits: 2 })} {unitLabel(bill.unit)}</td><td>{formatStoreCurrency(bill.costPerUnit, locale)}</td><td><strong>{formatStoreCurrency(bill.totalCost, locale)}</strong></td><td>{formatStoreCurrency(getBillPaidAmount(bill), locale)}</td><td>{formatStoreCurrency(getBillRemaining(bill), locale)}</td><td><PaymentStatus status={status} /></td><td><div className="store-row-actions"><button type="button" className="button button-small button-outline" onClick={() => onViewBill(bill)}>View bill</button>{status !== 'paid' && <button type="button" className="button button-small button-outline" onClick={() => onRecordPayment(bill)}>Record payment</button>}</div></td></tr>
}

function BillCard({ bill, locale, onRecordPayment, onViewBill }: { bill: ImportBill; locale: string; onRecordPayment: (bill: ImportBill) => void; onViewBill: (bill: ImportBill) => void }) {
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${bill.date}T00:00:00`))
  const status = getBillPaymentStatus(bill)
  return (
    <article className="store-mobile-bill-card">
      <div className="store-mobile-bill-heading">
        <div><h3>{bill.itemName}</h3><span>{bill.supplierName} · {date}</span></div>
        <PaymentStatus status={status} />
      </div>
      <div className="store-mobile-bill-quantity"><span>Quantity</span><strong>{bill.quantity.toLocaleString(locale, { maximumFractionDigits: 2 })} {unitLabel(bill.unit)}</strong></div>
      <div className="store-mobile-bill-quantity"><span>Cost per unit</span><strong>{formatStoreCurrency(bill.costPerUnit, locale)}</strong></div>
      <div className="store-mobile-bill-stats">
        <div><span>Total</span><strong>{formatStoreCurrency(bill.totalCost, locale)}</strong></div>
        <div><span>Paid</span><strong>{formatStoreCurrency(getBillPaidAmount(bill), locale)}</strong></div>
        <div><span>Due</span><strong>{formatStoreCurrency(getBillRemaining(bill), locale)}</strong></div>
      </div>
      <div className="store-mobile-bill-actions">
        <button type="button" className="button button-outline" onClick={() => onViewBill(bill)}>View bill</button>
        {status !== 'paid' && <button type="button" className="button button-primary" onClick={() => onRecordPayment(bill)}>Record payment</button>}
      </div>
    </article>
  )
}

function GroupRows({ group, locale, expanded, onToggle, onRecordPayment, onViewBill }: { group: BillGroup; locale: string; expanded: boolean; onToggle: () => void; onRecordPayment: (bill: ImportBill) => void; onViewBill: (bill: ImportBill) => void }) {
  return <>
    <tr className="store-group-row"><td colSpan={10}><button type="button" className="store-group-toggle" aria-expanded={expanded} onClick={onToggle}><span aria-hidden="true">{expanded ? '−' : '+'}</span>{group.label}<small>{group.bills.length} bills</small></button></td></tr>
    {expanded && group.bills.map((bill) => <BillRow key={bill.id} bill={bill} locale={locale} onRecordPayment={onRecordPayment} onViewBill={onViewBill} />)}
    <tr className="store-group-subtotal"><td colSpan={3}>Subtotal</td><td>{group.quantity === null ? '—' : `${group.quantity.toLocaleString(locale, { maximumFractionDigits: 2 })} ${group.unit ? unitLabel(group.unit) : ''}`}</td><td>—</td><td>{formatStoreCurrency(group.totalCost, locale)}</td><td>{formatStoreCurrency(group.totalPaid, locale)}</td><td>{formatStoreCurrency(group.remaining, locale)}</td><td colSpan={2}>—</td></tr>
  </>
}

export function BillsTable({
  bills,
  groupedBills,
  groupBy,
  filters,
  itemNames,
  suppliers,
  totalCost,
  totalPaid,
  remaining,
  totalQuantity,
  totalUnit,
  locale,
  onItemNameChange,
  onSupplierChange,
  onFromChange,
  onToChange,
  onGroupByChange,
  onStatusChange,
  onClearFilters,
  onRecordPayment,
  onViewBill,
}: {
  bills: ImportBill[]
  groupedBills: BillGroup[]
  groupBy: BillsGroupBy
  filters: { itemName: string; supplierName: string; from: string; to: string; status: BillStatusFilter }
  itemNames: string[]
  suppliers: string[]
  totalCost: number
  totalPaid: number
  remaining: number
  totalQuantity: number | null
  totalUnit: StoreUnit | null
  locale: string
  onItemNameChange: (value: string) => void
  onSupplierChange: (value: string) => void
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onGroupByChange: (value: BillsGroupBy) => void
  onStatusChange: (value: BillStatusFilter) => void
  onClearFilters: () => void
  onRecordPayment: (bill: ImportBill) => void
  onViewBill: (bill: ImportBill) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  return (
    <div className="panel store-panel">
      <div className="list-toolbar"><div><h2>Import bills</h2><p>Purchase history and expenditure totals.</p></div></div>
      <BillFilters itemName={filters.itemName} supplierName={filters.supplierName} from={filters.from} to={filters.to} itemNames={itemNames} suppliers={suppliers} groupBy={groupBy} status={filters.status} onItemNameChange={onItemNameChange} onSupplierChange={onSupplierChange} onFromChange={onFromChange} onToChange={onToChange} onGroupByChange={onGroupByChange} onStatusChange={onStatusChange} onClear={onClearFilters} />
      <div className="store-table-scroll" role="region" aria-label="Import bills table" tabIndex={0}>
        <table className="store-table store-bills-table">
          <thead><tr><th>Date</th><th>Item</th><th>Supplier</th><th>Quantity</th><th>Cost / unit</th><th>Total cost</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {groupBy === 'none' && bills.map((bill) => <BillRow key={bill.id} bill={bill} locale={locale} onRecordPayment={onRecordPayment} onViewBill={onViewBill} />)}
            {groupBy !== 'none' && groupedBills.map((group) => <GroupRows key={group.key} group={group} locale={locale} expanded={!collapsed[group.key]} onToggle={() => setCollapsed((state) => ({ ...state, [group.key]: !state[group.key] }))} onRecordPayment={onRecordPayment} onViewBill={onViewBill} />)}
            {!bills.length && <tr><td className="empty-cell" colSpan={10}>No import bills match these filters.</td></tr>}
          </tbody>
          <TableTotalRow cells={['Total', '—', '—', totalQuantity === null ? '—' : `${totalQuantity.toLocaleString(locale, { maximumFractionDigits: 2 })} ${totalUnit ? unitLabel(totalUnit) : ''}`, '—', formatStoreCurrency(totalCost, locale), formatStoreCurrency(totalPaid, locale), formatStoreCurrency(remaining, locale), '—', '—']} />
        </table>
      </div>
      <div className="store-mobile-bill-list" role="region" aria-label="Import bills">
        {groupBy === 'none' && bills.map((bill) => <BillCard key={bill.id} bill={bill} locale={locale} onRecordPayment={onRecordPayment} onViewBill={onViewBill} />)}
        {groupBy !== 'none' && groupedBills.map((group) => (
          <section className="store-mobile-bill-group" key={group.key}>
            <button type="button" className="store-mobile-group-toggle" aria-expanded={!collapsed[group.key]} onClick={() => setCollapsed((state) => ({ ...state, [group.key]: !state[group.key] }))}>
              <span>{group.label}</span><small>{group.bills.length} bills</small><span aria-hidden="true">{collapsed[group.key] ? '+' : '−'}</span>
            </button>
            {!collapsed[group.key] && group.bills.map((bill) => <BillCard key={bill.id} bill={bill} locale={locale} onRecordPayment={onRecordPayment} onViewBill={onViewBill} />)}
            <div className="store-mobile-group-total">
              <span>Group total</span><strong>{formatStoreCurrency(group.totalCost, locale)}</strong>
              <small>Paid {formatStoreCurrency(group.totalPaid, locale)} · Due {formatStoreCurrency(group.remaining, locale)}</small>
            </div>
          </section>
        ))}
        {!bills.length && <p className="store-mobile-empty">No import bills match these filters.</p>}
        <div className="store-mobile-list-total">
          <span>Filtered totals</span>
          <strong>{formatStoreCurrency(totalCost, locale)}</strong>
          <small>Paid {formatStoreCurrency(totalPaid, locale)} · Due {formatStoreCurrency(remaining, locale)}</small>
          {totalQuantity !== null && <small>Quantity {totalQuantity.toLocaleString(locale, { maximumFractionDigits: 2 })} {totalUnit ? unitLabel(totalUnit) : ''}</small>}
        </div>
      </div>
    </div>
  )
}
