import { createPortal } from 'react-dom'
import { Dialog } from '@/shared/components/Dialog'
import type { UiLanguage } from '@/i18n'
import type { ImportBill } from '@/features/store-expenditure/types'
import {
  formatStoreCurrency,
  getBillPaidAmount,
  getBillPaymentStatus,
  getBillRemaining,
  unitLabel,
} from '@/features/store-expenditure/utils'

export function BillDetailsDialog({
  bill,
  locale,
  language,
  onClose,
}: {
  bill: ImportBill
  locale: string
  language: UiLanguage
  onClose: () => void
}) {
  const paid = getBillPaidAmount(bill)
  const remaining = getBillRemaining(bill)
  const status = getBillPaymentStatus(bill)
  const purchaseDate = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    .format(new Date(`${bill.date}T00:00:00`))

  return createPortal(
    <Dialog title="Bill details" onClose={onClose} className="store-bill-dialog" language={language}>
      <div className="store-printable-bill">
        <header className="store-bill-heading">
          <div><h3>Purchase bill</h3><p>Bill reference: {bill.id}</p></div>
          <span className={`store-payment-status ${status.replace(' ', '-')}`}>{status}</span>
        </header>
        <dl className="store-bill-summary">
          <div><dt>Purchase date</dt><dd>{purchaseDate}</dd></div>
          <div><dt>Supplier</dt><dd>{bill.supplierName}</dd></div>
          <div><dt>Item</dt><dd>{bill.itemName}</dd></div>
          <div><dt>Quantity</dt><dd>{bill.quantity.toLocaleString(locale, { maximumFractionDigits: 2 })} {unitLabel(bill.unit)}</dd></div>
          <div><dt>Cost per unit</dt><dd>{formatStoreCurrency(bill.costPerUnit, locale)}</dd></div>
          <div><dt>Total bill</dt><dd>{formatStoreCurrency(bill.totalCost, locale)}</dd></div>
        </dl>
        <h4>Payment history</h4>
        {bill.payments.length
          ? <table className="store-bill-history">
              <thead><tr><th>#</th><th>Date and time</th><th>Paid by</th><th>Amount</th></tr></thead>
              <tbody>{bill.payments.map((payment, index) => (
                <tr key={payment.id}>
                  <td>{index + 1}</td>
                  <td>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(payment.paidAt))}</td>
                  <td>{payment.method === 'unspecified' ? 'Not recorded' : payment.method === 'upi' ? 'UPI' : 'Cash'}</td>
                  <td>{formatStoreCurrency(payment.amount, locale)}</td>
                </tr>
              ))}</tbody>
            </table>
          : <p className="store-no-payments">No payments have been recorded for this bill.</p>}
        <dl className="store-bill-totals">
          <div><dt>Total paid</dt><dd>{formatStoreCurrency(paid, locale)}</dd></div>
          <div><dt>Balance due</dt><dd>{formatStoreCurrency(remaining, locale)}</dd></div>
        </dl>
      </div>
      <div className="dialog-actions store-bill-print-actions">
        <button type="button" className="button button-outline" onClick={onClose}>Close</button>
        <button type="button" className="button button-primary" onClick={() => window.print()}>Print bill</button>
      </div>
    </Dialog>,
    document.querySelector('.app-shell') ?? document.body,
  )
}
