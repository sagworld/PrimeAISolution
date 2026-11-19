import { useState, type FormEvent } from 'react'
import { Dialog } from '@/shared/components/Dialog'
import { dateInputValue } from '@/shared/utils/appUtils'
import { calculateTotalCost, formatStoreCurrency, unitLabel } from '@/features/store-expenditure/utils'
import { dateLocale, type UiLanguage } from '@/i18n'
import type { StoreItem } from '@/features/store-expenditure/types'

export function ImportForm({
  item,
  suppliers,
  language,
  onSave,
  onCancel,
}: {
  item: StoreItem
  suppliers: string[]
  language: UiLanguage
  onSave: (draft: { itemId: string; supplierName: string; quantity: number; costPerUnit: number; amountPaid: number; date: string }) => void
  onCancel: () => void
}) {
  const [supplierName, setSupplierName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [amountPaid, setAmountPaid] = useState('0')
  const [date, setDate] = useState(dateInputValue())
  const [error, setError] = useState('')
  const totalCost = calculateTotalCost(Number(quantity) || 0, Number(costPerUnit) || 0)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      onSave({ itemId: item.id, supplierName, quantity: Number(quantity), costPerUnit: Number(costPerUnit), amountPaid: Number(amountPaid), date })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record this import.')
    }
  }

  return (
    <Dialog title="Import stock" onClose={onCancel} language={language}>
      <form className="dialog-form" onSubmit={submit}>
        <label>Item name<input readOnly value={item.name} /></label>
        <label>Supplier name<input required list="store-supplier-options" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} /><datalist id="store-supplier-options">{suppliers.map((supplier) => <option key={supplier} value={supplier} />)}</datalist></label>
        <label>Quantity ({unitLabel(item.unit)})<input required type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label>Cost per unit (₹)<input required type="number" min="0" step="0.01" value={costPerUnit} onChange={(event) => setCostPerUnit(event.target.value)} /></label>
        <label>Amount paid now (₹)<input required type="number" min="0" max={totalCost} step="0.01" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} /></label>
        <label>Purchase date<input required type="date" max={dateInputValue()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <div className="store-cost-preview"><span>Total cost<br />Remaining after payment</span><strong>{formatStoreCurrency(totalCost, dateLocale(language))}<br />{formatStoreCurrency(Math.max(0, totalCost - (Number(amountPaid) || 0)), dateLocale(language))}</strong></div>
        {error && <p className="store-form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-outline" onClick={onCancel}>Cancel</button>
          <button type="submit" className="button button-primary">Record import</button>
        </div>
      </form>
    </Dialog>
  )
}
