import { useState, type FormEvent } from 'react'
import { Dialog } from '@/shared/components/Dialog'
import type { UiLanguage } from '@/i18n'
import type { ImportBill, PaymentMethod } from '@/features/store-expenditure/types'
import { formatStoreCurrency, getBillRemaining } from '@/features/store-expenditure/utils'

export function PaymentForm({
  bill,
  locale,
  language,
  onSave,
  onCancel,
}: {
  bill: ImportBill
  locale: string
  language: UiLanguage
  onSave: (billId: string, amount: number, method: PaymentMethod) => void | Promise<void>
  onCancel: () => void
}) {
  const remaining = getBillRemaining(bill)
  const [amount, setAmount] = useState(String(remaining))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      await onSave(bill.id, Number(amount), method)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to record this payment.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog title="Record bill payment" onClose={onCancel} language={language}>
      <form className="dialog-form" onSubmit={submit}>
        <p className="form-intro">{bill.itemName} · {bill.supplierName}</p>
        <div className="store-payment-balance"><span>Outstanding balance</span><strong>{formatStoreCurrency(remaining, locale)}</strong></div>
        <label>Payment amount (₹)<input autoFocus required type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Paid by<select value={method} onChange={(event) => setMethod(event.target.value === 'upi' ? 'upi' : 'cash')}><option value="cash">Cash</option><option value="upi">UPI</option></select></label>
        {error && <p className="store-form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-outline" onClick={onCancel} disabled={isSaving}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
