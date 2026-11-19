import { useState } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { AddItemForm } from '@/features/store-expenditure/components/AddItemForm'
import { BillDetailsDialog } from '@/features/store-expenditure/components/BillDetailsDialog'
import { BillsTable } from '@/features/store-expenditure/components/BillsTable'
import { ImportForm } from '@/features/store-expenditure/components/ImportForm'
import { InventoryTable } from '@/features/store-expenditure/components/InventoryTable'
import { PaymentForm } from '@/features/store-expenditure/components/PaymentForm'
import { useImportBills } from '@/features/store-expenditure/hooks/useImportBills'
import { useInventory } from '@/features/store-expenditure/hooks/useInventory'
import type { ImportBill, InventoryRow, PaymentMethod, StoreItem } from '@/features/store-expenditure/types'

type View = 'inventory' | 'bills'

export function StoreExpenditurePage() {
  const { section, uiLanguage, notify } = useAppContext()
  const inventory = useInventory()
  const bills = useImportBills()
  const [view, setView] = useState<View>('inventory')
  const [addingItem, setAddingItem] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryRow | null>(null)
  const [importingItem, setImportingItem] = useState<StoreItem | null>(null)
  const [payingBill, setPayingBill] = useState<ImportBill | null>(null)
  const [viewingBill, setViewingBill] = useState<ImportBill | null>(null)
  const locale = uiLanguage === 'mr' ? 'mr-IN' : uiLanguage === 'hi' ? 'hi-IN' : 'en-IN'
  const totalExpenditure = inventory.items.reduce((sum, item) => sum + item.totalExpenditure, 0)

  function saveItem(draft: { name: string; category: 'equipment' | 'material'; unit: 'quantity' | 'kg' | 'litre'; threshold: number }) {
    if (editingItem) {
      inventory.updateItem(editingItem.id, { name: draft.name, category: draft.category, unit: draft.unit, threshold: draft.threshold })
    } else {
      inventory.addItem(draft)
    }
    setAddingItem(false)
    setEditingItem(null)
    notify(editingItem ? 'Item updated.' : 'Item added.')
  }

  function saveImport(draft: { itemId: string; supplierName: string; quantity: number; costPerUnit: number; amountPaid: number; paymentMethod: PaymentMethod; date: string }) {
    bills.recordImport(draft)
    setImportingItem(null)
    notify('Import recorded.')
  }

  function savePayment(billId: string, amount: number, method: PaymentMethod) {
    bills.recordPayment(billId, amount, method)
    setPayingBill(null)
    notify('Payment recorded.')
  }

  function removeItem(item: InventoryRow) {
    if (!window.confirm(`Remove "${item.name}" from inventory? Its import bills will remain in history, but its remaining stock will no longer be tracked.`)) return
    inventory.removeItem(item.id)
    notify('Item removed from inventory.')
  }

  return section === 'store-expenditure' ? (
    <section className="page-section store-expenditure-page">
      <div className="store-view-toggle" role="group" aria-label="Store and expenditure view">
        <button type="button" className={view === 'inventory' ? 'selected' : ''} aria-pressed={view === 'inventory'} onClick={() => setView('inventory')}>Inventory</button>
        <button type="button" className={view === 'bills' ? 'selected' : ''} aria-pressed={view === 'bills'} onClick={() => setView('bills')}>Import Bills</button>
      </div>
      {view === 'inventory'
        ? <InventoryTable items={inventory.items} totalExpenditure={totalExpenditure} locale={locale} search={inventory.search} lowStockOnly={inventory.lowStockOnly} onSearchChange={inventory.setSearch} onLowStockChange={inventory.setLowStockOnly} onAdd={() => setAddingItem(true)} onImport={(item) => setImportingItem(item)} onEdit={(item) => setEditingItem(item)} onRemove={removeItem} />
        : <BillsTable bills={bills.bills} groupedBills={bills.groupedBills} groupBy={bills.groupBy} filters={bills.filters} itemNames={bills.itemNames} suppliers={bills.suppliers} totalCost={bills.totals.totalCost} totalPaid={bills.totals.totalPaid} remaining={bills.totals.remaining} totalQuantity={bills.totals.quantity} totalUnit={bills.totals.unit} locale={locale} onItemNameChange={bills.setItemName} onSupplierChange={bills.setSupplierName} onFromChange={bills.setFrom} onToChange={bills.setTo} onGroupByChange={bills.setGroupBy} onStatusChange={bills.setStatus} onClearFilters={bills.clearFilters} onRecordPayment={setPayingBill} onViewBill={setViewingBill} />}
      {(addingItem || editingItem) && <AddItemForm item={editingItem} unitLocked={editingItem ? inventory.hasBills(editingItem) : false} language={uiLanguage} onSave={saveItem} onCancel={() => { setAddingItem(false); setEditingItem(null) }} />}
      {importingItem && <ImportForm item={importingItem} suppliers={bills.suppliers} language={uiLanguage} onSave={saveImport} onCancel={() => setImportingItem(null)} />}
      {payingBill && <PaymentForm bill={payingBill} locale={locale} language={uiLanguage} onSave={savePayment} onCancel={() => setPayingBill(null)} />}
      {viewingBill && <BillDetailsDialog bill={viewingBill} locale={locale} language={uiLanguage} onClose={() => setViewingBill(null)} />}
    </section>
  ) : null
}
