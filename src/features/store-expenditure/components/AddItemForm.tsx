import { useState, type FormEvent } from 'react'
import { Dialog } from '@/shared/components/Dialog'
import type { UiLanguage } from '@/i18n'
import type { StoreItem, StoreItemCategory, StoreUnit } from '@/features/store-expenditure/types'

type ItemDraft = {
  name: string
  category: StoreItemCategory
  unit: StoreUnit
  threshold: number
}

export function AddItemForm({
  item,
  unitLocked,
  language,
  onSave,
  onCancel,
}: {
  item: StoreItem | null
  unitLocked: boolean
  language: UiLanguage
  onSave: (draft: ItemDraft) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<StoreItemCategory>(item?.category ?? 'material')
  const [unit, setUnit] = useState<StoreUnit>(item?.unit ?? 'quantity')
  const [threshold, setThreshold] = useState(String(item?.threshold ?? 0))
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      onSave({ name, category, unit, threshold: Number(threshold) })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this item.')
    }
  }

  return (
    <Dialog title={item ? 'Edit item' : 'Add item'} onClose={onCancel} language={language}>
      <form className="dialog-form" onSubmit={submit}>
        <label>Item name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Category<select value={category} onChange={(event) => {
          if (event.target.value === 'equipment' || event.target.value === 'material') setCategory(event.target.value)
        }}><option value="equipment">Equipment</option><option value="material">Material</option></select></label>
        <label>Unit<select value={unit} disabled={unitLocked} onChange={(event) => {
          if (event.target.value === 'quantity' || event.target.value === 'kg' || event.target.value === 'litre') setUnit(event.target.value)
        }}><option value="quantity">Quantity</option><option value="kg">kg</option><option value="litre">litre</option></select></label>
        <label>Low-stock threshold<input required type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
        {error && <p className="store-form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-outline" onClick={onCancel}>Cancel</button>
          <button type="submit" className="button button-primary">{item ? 'Save changes' : 'Add item'}</button>
        </div>
      </form>
    </Dialog>
  )
}
