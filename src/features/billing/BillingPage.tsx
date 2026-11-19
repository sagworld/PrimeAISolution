import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { dateLocale } from '@/i18n'
import { dateInputValue, makeId } from '@/shared/utils/appUtils'
import { isPaymentMethod, isPaymentStatus, readBillingData, saveBillingData } from '@/features/billing/billingStorage'
import type { BillingData, BillingInvoice, BillingPaymentMethod, BillingPaymentStatus } from '@/features/billing/types'

type BillingDetailView = 'period' | 'month' | 'all'
type InvoiceGroup = { key: string; invoices: BillingInvoice[]; total: number }

function groupInvoicesBy(invoices: BillingInvoice[], getKey: (invoice: BillingInvoice) => string): InvoiceGroup[] {
  const grouped = new Map<string, BillingInvoice[]>()
  for (const invoice of invoices) {
    const key = getKey(invoice)
    grouped.set(key, [...(grouped.get(key) ?? []), invoice])
  }
  return [...grouped.entries()]
    .map(([key, groupInvoices]) => ({
      key,
      invoices: groupInvoices,
      total: groupInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
    }))
    .sort((first, second) => second.key.localeCompare(first.key))
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character)
}

export function BillingPage() {
  const { store, section, uiLanguage } = useAppContext()
  const [billingData, setBillingData] = useState<BillingData>(readBillingData)
  const [paymentQrDraft, setPaymentQrDraft] = useState(() => readBillingData().paymentQr)
  const [qrSaving, setQrSaving] = useState(false)
  const [billingFromDate, setBillingFromDate] = useState(() => dateInputValue())
  const [billingToDate, setBillingToDate] = useState(() => dateInputValue())
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [discount, setDiscount] = useState('0')
  const [paymentStatus, setPaymentStatus] = useState<BillingPaymentStatus>('Unpaid')
  const [paymentMethod, setPaymentMethod] = useState<BillingPaymentMethod>('')
  const [billingDetailView, setBillingDetailView] = useState<BillingDetailView | null>(null)
  const [expandedBillingDate, setExpandedBillingDate] = useState<string | null>(null)
  const [expandedBillingMonth, setExpandedBillingMonth] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const locale = dateLocale(uiLanguage)
  const today = dateInputValue()
  const monthPrefix = billingToDate.slice(0, 7)
  const selectedMonthIsCurrent = monthPrefix === today.slice(0, 7)
  const billableTests = store.tests.filter((test) => Number.isFinite(test.price) && test.price > 0)
  const availablePatients = store.patients.filter((item) =>
    !billingData.invoices.some((invoice) => invoice.patientId === item.id && invoice.status === 'Paid'),
  )
  const patient = store.patients.find((item) => item.id === selectedPatientId)
  const selectedTestRecords = selectedTests
    .map((testId) => billableTests.find((test) => test.id === testId))
    .filter((test): test is NonNullable<typeof test> => Boolean(test))
  const subTotal = selectedTestRecords.reduce((sum, test) =>
    sum + (Number.isFinite(test.price) ? Math.max(0, test.price) : 0), 0)
  const discountAmount = Number.parseFloat(discount) || 0
  const finalAmount = Math.max(0, subTotal - Math.max(0, discountAmount))
  const summary = billingData.invoices.reduce(
    (totals, invoice) => {
      totals.all += invoice.amount
      if (invoice.date >= billingFromDate && invoice.date <= billingToDate) totals.selectedPeriod += invoice.amount
      if (invoice.date.startsWith(monthPrefix)) totals.month += invoice.amount
      return totals
    },
    { selectedPeriod: 0, month: 0, all: 0 },
  )
  const sortedInvoices = [...billingData.invoices]
    .sort((first, second) => second.date.localeCompare(first.date) || second.id.localeCompare(first.id))
  const selectedPeriodInvoices = sortedInvoices.filter((invoice) => invoice.date >= billingFromDate && invoice.date <= billingToDate)
  const monthInvoices = sortedInvoices.filter((invoice) => invoice.date.startsWith(monthPrefix))
  const [currentYear, currentMonth] = monthPrefix.split('-').map(Number)
  const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate()
  const monthDayGroups = Array.from({ length: daysInCurrentMonth }, (_, index) => {
    const key = `${monthPrefix}-${String(index + 1).padStart(2, '0')}`
    const invoices = monthInvoices.filter((invoice) => invoice.date === key)
    return { key, invoices, total: invoices.reduce((sum, invoice) => sum + invoice.amount, 0) }
  })
  const allMonthGroups = groupInvoicesBy(sortedInvoices, (invoice) => invoice.date.slice(0, 7))

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount)
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
  }

  function formatMonth(month: string) {
    const [year, monthNumber] = month.split('-').map(Number)
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1))
  }

  function commitBillingData(next: BillingData) {
    try {
      saveBillingData(next)
      setBillingData(next)
      setError('')
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save billing data.')
      return false
    }
  }

  function selectPatient(patientId: string) {
    setSelectedPatientId(patientId)
    const patientOrderTestIds = [...new Set(
      store.orders.filter((order) => order.patientId === patientId).map((order) => order.testId),
    )].filter((testId) => billableTests.some((test) => test.id === testId))
    setSelectedTests(patientOrderTestIds)
  }

  function selectPatientFromSearch(value: string) {
    setPatientSearch(value)
    const selected = availablePatients.find((item) => `${item.name} (${item.id})` === value)
    selectPatient(selected?.id ?? '')
    if (!selected) setSelectedTests([])
  }

  function showBillingDetails(view: BillingDetailView) {
    setExpandedBillingDate(null)
    setExpandedBillingMonth(null)
    setBillingDetailView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function showDayInvoices(date: string) {
    setExpandedBillingDate((currentDate) => currentDate === date ? null : date)
    window.requestAnimationFrame(() => {
      document.getElementById('billing-day-invoices')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function showMonthInvoices(month: string) {
    setExpandedBillingMonth((currentMonthKey) => currentMonthKey === month ? null : month)
    window.requestAnimationFrame(() => {
      document.getElementById('billing-month-invoices')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function updateInvoicePaymentStatus(invoice: BillingInvoice, status: BillingPaymentStatus) {
    const updatedInvoice: BillingInvoice = {
      ...invoice,
      status,
      paymentMethod: status === 'Paid'
        ? invoice.paymentMethod !== '' ? invoice.paymentMethod : 'Cash'
        : '',
    }
    if (!commitBillingData({
      ...billingData,
      invoices: billingData.invoices.map((item) => item.id === invoice.id ? updatedInvoice : item),
    })) return
    if (status === 'Paid' && selectedPatientId === invoice.patientId) {
      setSelectedPatientId('')
      setPatientSearch('')
      setSelectedTests([])
    }
    setStatusMessage(`Invoice ${invoice.id} marked ${status.toLowerCase()}.`)
  }

  function updateInvoicePaymentMethod(invoice: BillingInvoice, method: BillingPaymentMethod) {
    if (!isPaymentMethod(method) || !method) return
    commitBillingData({
      ...billingData,
      invoices: billingData.invoices.map((item) =>
        item.id === invoice.id ? { ...item, paymentMethod: method } : item,
      ),
    })
  }

  function toggleTest(testId: string, checked: boolean) {
    setSelectedTests((current) => checked
      ? [...new Set([...current, testId])]
      : current.filter((id) => id !== testId))
  }

  function printInvoice(invoice: BillingInvoice) {
    const printWindow = window.open('', '_blank', 'width=700,height=800')
    if (!printWindow) {
      setError('The invoice window was blocked. Allow pop-ups and try again.')
      return
    }
    const itemRows = invoice.items.map((item) =>
      `<div class="row"><span>${escapeHtml(item.name)}</span><strong>₹${item.amount.toFixed(2)}</strong></div>`,
    ).join('')
    const qrSection = billingData.paymentQr
      ? `<div class="qr"><strong>Scan to pay</strong><br><img src="${escapeHtml(billingData.paymentQr)}" alt="Payment QR" /></div>`
      : ''
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.id)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:#f1f5f9;color:#172033}
      .invoice{max-width:680px;margin:24px auto;background:#fff;padding:36px;border-top:8px solid #2563eb}
      .brand,.row,.total{display:flex;justify-content:space-between;gap:20px}
      .brand{border-bottom:2px solid #e2e8f0;padding-bottom:18px}.brand h1{margin:0;color:#1d4ed8}
      .label{font-size:11px;color:#64748b}.patient{background:#eff6ff;padding:14px;margin:20px 0}
      .row{border-bottom:1px solid #e2e8f0;padding:11px 0}.total{font-size:22px;font-weight:700;margin-top:18px}
      .qr{text-align:center;margin-top:24px}.qr img{width:180px;height:180px;object-fit:contain;margin-top:8px}
      @media print{body{background:#fff}.invoice{margin:0;max-width:none}}
    </style></head><body><main class="invoice">
      <div class="brand"><div><h1>Prime AI Lab</h1><div class="label">Diagnostic Laboratory</div></div><div class="label">Patient Invoice</div></div>
      <div class="patient"><strong>${escapeHtml(invoice.patientName)}</strong><br><span class="label">Phone: ${escapeHtml(invoice.patientPhone || '-')}</span><br><span class="label">Date: ${escapeHtml(formatDate(invoice.date))}</span></div>
      <div class="row"><strong>Test name</strong><strong>Price</strong></div>${itemRows}
      <div class="row"><span>Discount</span><span>₹${invoice.discount.toFixed(2)}</span></div>
      <div class="total"><span>Total payable</span><span>₹${invoice.amount.toFixed(2)}</span></div>
      <p class="label">Payment status: ${escapeHtml(invoice.status)}${invoice.paymentMethod ? ` (${escapeHtml(invoice.paymentMethod)})` : ''}</p>
      ${qrSection}<p class="label" style="text-align:center;margin-top:28px">Thank you for choosing Prime AI Lab</p>
    </main></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setError('')
  }

  async function sendInvoiceOnWhatsApp(invoice: BillingInvoice) {
    const phone = invoice.patientPhone.replace(/\D/g, '')
    if (!phone) {
      setError('Patient phone number is not available.')
      return
    }
    const message = [
      `Prime AI Lab Invoice`,
      `Invoice: ${invoice.id}`,
      `Patient: ${invoice.patientName}`,
      `Tests: ${invoice.items.map((item) => item.name).join(', ') || 'Lab tests'}`,
      `Total: ${formatCurrency(invoice.amount)}`,
      `Status: ${invoice.status}`,
      ...(billingData.paymentQr ? ['PhonePe QR is available on the printed bill.'] : []),
    ].join('\n')
    const internationalPhone = phone.startsWith('91') ? phone : `91${phone}`
    window.open(`https://web.whatsapp.com/send?phone=${internationalPhone}&text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    setError('')
    if (!billingData.paymentQr) return

    try {
      const response = await fetch(billingData.paymentQr)
      if (!response.ok) throw new Error('Unable to read the payment QR image.')
      const qrBlob = await response.blob()
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ [qrBlob.type || 'image/png']: qrBlob })])
        setStatusMessage('WhatsApp Web opened. QR photo copied; paste it in the patient chat.')
        return
      }
    } catch (qrError) {
      console.error('Unable to copy the payment QR image.', qrError)
    }
    const download = document.createElement('a')
    download.href = billingData.paymentQr
    download.download = 'prime-ai-lab-payment-qr.png'
    document.body.appendChild(download)
    download.click()
    document.body.removeChild(download)
    setStatusMessage('WhatsApp Web opened. Payment QR downloaded; attach it to the same chat.')
  }

  function handleQrUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) {
      setError('Please choose an image smaller than 4 MB.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPaymentQrDraft(reader.result)
        setError('')
      } else {
        setError('Unable to read the selected payment QR image.')
      }
    }
    reader.onerror = () => setError('Unable to read the selected payment QR image.')
    reader.readAsDataURL(file)
  }

  function handleSaveQr() {
    if (!paymentQrDraft) {
      setError('Please upload a payment QR image first.')
      return
    }
    setQrSaving(true)
    const saved = commitBillingData({ ...billingData, paymentQr: paymentQrDraft })
    if (saved) setStatusMessage('Payment QR saved successfully.')
    setQrSaving(false)
  }

  function handleGenerateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!patient || selectedTestRecords.length === 0) {
      setError('Please select a patient and at least one test.')
      return
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      setError('Discount must be a non-negative amount.')
      return
    }
    if (paymentStatus === 'Paid' && !paymentMethod) {
      setError('Please select a payment method.')
      return
    }
    const invoice: BillingInvoice = {
      id: makeId('INV'),
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      items: selectedTestRecords.map((test) => ({
        testId: test.id,
        name: test.name,
        amount: Number.isFinite(test.price) ? Math.max(0, test.price) : 0,
      })),
      discount: discountAmount,
      amount: finalAmount,
      status: paymentStatus,
      paymentMethod: paymentStatus === 'Paid' ? paymentMethod : '',
      date: billingToDate,
    }
    if (!commitBillingData({ ...billingData, invoices: [invoice, ...billingData.invoices] })) return
    setStatusMessage('Invoice created successfully.')
    setSelectedPatientId('')
    setPatientSearch('')
    setSelectedTests([])
    setDiscount('0')
    setPaymentStatus('Unpaid')
    setPaymentMethod('')
    printInvoice(invoice)
  }

  function handleExportToTally() {
    const exportInvoices = billingData.invoices.filter((invoice) => invoice.date >= billingFromDate && invoice.date <= billingToDate)
    if (!exportInvoices.length) {
      setError('No invoices found for the selected date range.')
      return
    }
    const voucherMessages = exportInvoices.map((invoice) => {
      const date = invoice.date.replace(/-/g, '')
      const patientName = escapeXml(invoice.patientName || 'Cash')
      return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${date}</DATE>
            <VOUCHERNUMBER>${escapeXml(invoice.id)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${patientName}</PARTYLEDGERNAME>
            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${patientName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${invoice.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Laboratory Sales</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${invoice.amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>`
    }).join('\n')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA>
  <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>Prime AI Lab</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
  <REQUESTDATA>${voucherMessages}</REQUESTDATA>
</IMPORTDATA></BODY></ENVELOPE>`
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }))
    const download = document.createElement('a')
    download.href = url
    download.download = `prime_ai_lab_tally_export_${billingFromDate}_to_${billingToDate}.xml`
    document.body.appendChild(download)
    download.click()
    document.body.removeChild(download)
    URL.revokeObjectURL(url)
    setError('')
    setStatusMessage(`Tally XML export generated for ${formatDate(billingFromDate)} to ${formatDate(billingToDate)} and downloaded successfully.`)
  }

  function renderInvoiceTable(invoices: BillingInvoice[]) {
    return (
      <div className="billing-table-wrap">
        <table className="billing-table">
          <thead><tr><th>Patient</th><th>Tests</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td><strong>{invoice.patientName}</strong><small>{invoice.id}</small></td>
                <td>{invoice.items.map((item) => item.name).join(', ')}</td>
                <td><strong>{formatCurrency(invoice.amount)}</strong></td>
                <td>
                  <select
                    className={`billing-status-select ${invoice.status.toLowerCase()}`}
                    aria-label={`Payment status for invoice ${invoice.id}`}
                    value={invoice.status}
                    onChange={(event) => {
                      if (isPaymentStatus(event.target.value)) updateInvoicePaymentStatus(invoice, event.target.value)
                    }}
                  >
                    <option value="Unpaid">Unpaid</option><option value="Paid">Paid</option>
                  </select>
                  {invoice.status === 'Paid' && (
                    <select
                      className="billing-payment-method-select"
                      aria-label={`Payment method for invoice ${invoice.id}`}
                      value={invoice.paymentMethod || 'Cash'}
                      onChange={(event) => {
                        if (isPaymentMethod(event.target.value)) updateInvoicePaymentMethod(invoice, event.target.value)
                      }}
                    >
                      <option value="Cash">Cash</option><option value="Online">Online</option>
                    </select>
                  )}
                </td>
                <td>{formatDate(invoice.date)}</td>
                <td><div className="billing-row-actions">
                  <button type="button" className="button button-small button-outline" onClick={() => printInvoice(invoice)}>Print</button>
                  <button type="button" className="button button-small button-outline" onClick={() => { void sendInvoiceOnWhatsApp(invoice) }}>WhatsApp</button>
                </div></td>
              </tr>
            ))}
            {!invoices.length && <tr><td className="empty-cell" colSpan={6}>No invoices found.</td></tr>}
          </tbody>
        </table>
      </div>
    )
  }

  return section === 'billing' ? (
    billingDetailView ? (
      <section className="page-section billing-page billing-detail-page">
        <div className="billing-detail-header">
          <button type="button" className="button button-outline" onClick={() => { setExpandedBillingDate(null); setExpandedBillingMonth(null); setBillingDetailView(null) }}>← Back to billing</button>
          <div>
            <span className="eyebrow">BILLING DETAILS</span>
            <h1>{billingDetailView === 'period' ? 'Selected-period billing' : billingDetailView === 'month' ? `${formatMonth(monthPrefix)} billing` : 'All-time billing'}</h1>
            <p>{billingDetailView === 'period' ? `${formatDate(billingFromDate)} to ${formatDate(billingToDate)}` : billingDetailView === 'month' ? formatMonth(monthPrefix) : 'Month-wise invoice summary and details'}</p>
          </div>
        </div>
        <div className="billing-detail-total">
          <span>{billingDetailView === 'period' ? 'Selected-period total' : billingDetailView === 'month' ? 'Selected-month total' : 'All-time total'}</span>
          <strong>{formatCurrency(billingDetailView === 'period' ? summary.selectedPeriod : billingDetailView === 'month' ? summary.month : summary.all)}</strong>
          <small>{billingDetailView === 'period' ? selectedPeriodInvoices.length : billingDetailView === 'month' ? monthInvoices.length : sortedInvoices.length} invoices</small>
        </div>
        {billingDetailView === 'period' && (
          <section className="panel billing-detail-group">
            <div className="billing-detail-group-heading"><h2>{formatDate(billingFromDate)} to {formatDate(billingToDate)}</h2><strong>{formatCurrency(summary.selectedPeriod)}</strong></div>
            {renderInvoiceTable(selectedPeriodInvoices)}
          </section>
        )}
        {billingDetailView === 'month' && (monthDayGroups.length
          ? <>
              <section className="panel billing-detail-group">
                <div className="billing-detail-group-heading"><h2>Date-wise totals</h2><strong>{formatMonth(monthPrefix)}</strong></div>
                <div className="billing-table-wrap">
                  <table className="billing-day-summary-table">
                    <thead><tr><th>Date</th><th>Invoices</th><th>Daily total</th><th>Details</th></tr></thead>
                    <tbody>{monthDayGroups.map((group) => (
                      <tr key={group.key}>
                        <td>{formatDate(group.key)}</td>
                        <td>{group.invoices.length.toLocaleString(locale)}</td>
                        <td><strong>{formatCurrency(group.total)}</strong></td>
                        <td>{group.invoices.length
                          ? <button type="button" className="button button-small button-outline" aria-expanded={expandedBillingDate === group.key} onClick={() => showDayInvoices(group.key)}>{expandedBillingDate === group.key ? 'Hide invoices' : 'View invoices'}</button>
                          : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
              {expandedBillingDate && (
                <section className="panel billing-detail-group billing-expanded-day" id="billing-day-invoices">
                  <div className="billing-detail-group-heading">
                    <h2>{formatDate(expandedBillingDate)} invoices</h2>
                    <strong>{formatCurrency(monthDayGroups.find((group) => group.key === expandedBillingDate)?.total ?? 0)}</strong>
                  </div>
                  {renderInvoiceTable(monthDayGroups.find((group) => group.key === expandedBillingDate)?.invoices ?? [])}
                </section>
              )}
            </>
          : <p className="empty-message">No invoices found for this month.</p>)}
        {billingDetailView === 'all' && (allMonthGroups.length
          ? <>
              <section className="panel billing-detail-group">
                <div className="billing-detail-group-heading"><h2>Monthly totals</h2><strong>{allMonthGroups.length} months</strong></div>
                <div className="billing-table-wrap">
                  <table className="billing-day-summary-table">
                    <thead><tr><th>Month</th><th>Invoices</th><th>Monthly total</th></tr></thead>
                    <tbody>{allMonthGroups.map((group) => (
                      <tr key={group.key}>
                        <td><button type="button" className="billing-month-link" aria-expanded={expandedBillingMonth === group.key} onClick={() => showMonthInvoices(group.key)}>{formatMonth(group.key)}</button></td>
                        <td>{group.invoices.length.toLocaleString(locale)}</td>
                        <td><strong>{formatCurrency(group.total)}</strong></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
              {expandedBillingMonth && (
                <section className="panel billing-detail-group" id="billing-month-invoices">
                  <div className="billing-detail-group-heading">
                    <h2>{formatMonth(expandedBillingMonth)} invoices</h2>
                    <strong>{formatCurrency(allMonthGroups.find((group) => group.key === expandedBillingMonth)?.total ?? 0)}</strong>
                  </div>
                  {renderInvoiceTable(allMonthGroups.find((group) => group.key === expandedBillingMonth)?.invoices ?? [])}
                </section>
              )}
            </>
          : <p className="empty-message">No invoices found.</p>)}
      </section>
    ) : (
    <section className="page-section billing-page">
      <div className="page-heading billing-heading">
        <div><span className="eyebrow">BILLING</span><h1>Billing &amp; Accounting</h1><p>Patient invoicing and payment records.</p></div>
      <div className="billing-export-controls">
        <label><span>From date</span><input type="date" max={billingToDate} value={billingFromDate} onChange={(event) => { if (event.target.value) setBillingFromDate(event.target.value) }} /></label>
        <label><span>To date</span><input type="date" min={billingFromDate} value={billingToDate} onChange={(event) => { if (event.target.value) setBillingToDate(event.target.value) }} /></label>
        <button type="button" className="button button-primary" onClick={handleExportToTally}>Export to Tally</button>
      </div>
      </div>
      {error && <div className="billing-message billing-error" role="alert">{error}</div>}
      {statusMessage && <div className="billing-message billing-success" role="status">{statusMessage}</div>}

      <div className="billing-summary-grid">
        <button type="button" className="billing-summary-card" onClick={() => showBillingDetails('period')}>
          <span>Selected period total</span><strong>{formatCurrency(summary.selectedPeriod)}</strong><small>Click to view invoices in selected period</small>
        </button>
        <button type="button" className="billing-summary-card" onClick={() => showBillingDetails('month')}>
          <span>{selectedMonthIsCurrent ? 'This month' : formatMonth(monthPrefix)}</span><strong>{formatCurrency(summary.month)}</strong><small>Click for date-wise invoices</small>
        </button>
        <button type="button" className="billing-summary-card" onClick={() => showBillingDetails('all')}>
          <span>All time billing</span><strong>{formatCurrency(summary.all)}</strong><small>Click for all invoices</small>
        </button>
      </div>

      <section className="billing-qr-panel">
        <div><h2>PhonePe QR</h2><p>Upload or replace the payment QR used on printed invoices.</p></div>
        <div className="billing-qr-controls">
          <div className="billing-qr-preview">
            {paymentQrDraft ? <img src={paymentQrDraft} alt="PhonePe payment QR preview" /> : <span>No QR uploaded</span>}
          </div>
          <div className="billing-qr-upload">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleQrUpload} aria-label="Upload PhonePe payment QR" />
            <button type="button" className="button button-outline" onClick={handleSaveQr} disabled={qrSaving || !paymentQrDraft}>
              {qrSaving ? 'Saving…' : 'Save PhonePe QR'}
            </button>
          </div>
        </div>
      </section>

      <div className="billing-content-grid">
        <section className="panel billing-history-panel">
          <div className="panel-heading"><div><h2>{formatDate(billingFromDate)} to {formatDate(billingToDate)} invoices</h2><p>{selectedPeriodInvoices.length} invoice{selectedPeriodInvoices.length === 1 ? '' : 's'}</p></div></div>
          {renderInvoiceTable(selectedPeriodInvoices)}
        </section>

        <section className="panel billing-invoice-panel">
          <h2>Quick Generate Invoice</h2>
          <form className="billing-form" onSubmit={handleGenerateInvoice}>
            <label>Patient
              <input
                required
                type="search"
                list="billing-patient-options"
                value={patientSearch}
                onChange={(event) => selectPatientFromSearch(event.target.value)}
                placeholder="Search patient name or ID"
                aria-label="Search patient name or ID"
              />
              <datalist id="billing-patient-options">
                {availablePatients.map((item) => <option key={item.id} value={`${item.name} (${item.id})`} />)}
              </datalist>
            </label>
            <fieldset>
              <legend>Tests / Items</legend>
              <div className="billing-test-list">
                {billableTests.map((test) => (
                  <label key={test.id}>
                    <input type="checkbox" checked={selectedTests.includes(test.id)} onChange={(event) => toggleTest(test.id, event.target.checked)} />
                    <span>{test.name}</span><strong>{formatCurrency(test.price)}</strong>
                  </label>
                ))}
                {!billableTests.length && <p className="empty-message">No priced tests found. Add prices to tests in the catalogue before billing.</p>}
              </div>
            </fieldset>
            <div className="billing-total-line"><span>Subtotal</span><strong>{formatCurrency(subTotal)}</strong></div>
            <label>Discount (₹)
              <input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </label>
            <label>Payment Status
              <select value={paymentStatus} onChange={(event) => {
                if (!isPaymentStatus(event.target.value)) return
                setPaymentStatus(event.target.value)
                if (event.target.value === 'Unpaid') setPaymentMethod('')
              }}>
                <option value="Unpaid">Unpaid</option><option value="Paid">Paid</option>
              </select>
            </label>
            {paymentStatus === 'Paid' && (
              <label>Payment Method
                <select required value={paymentMethod} onChange={(event) => {
                  if (isPaymentMethod(event.target.value)) setPaymentMethod(event.target.value)
                }}>
                  <option value="">Select method</option><option value="Cash">Cash</option><option value="Online">Online</option>
                </select>
              </label>
            )}
            <div className="billing-total-line final"><span>Final Amount</span><strong>{formatCurrency(finalAmount)}</strong></div>
            <button type="submit" className="button button-primary">Create Invoice</button>
            <p className="billing-form-note">Invoices are saved in this browser. Do not enter real patient information.</p>
          </form>
        </section>
      </div>
    </section>
    )
  ) : null
}
