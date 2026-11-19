import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function usePatientReport(state: LabAppState, { persist, notify }: AppCoreActions) {
  const {
    store, reportPatientId, reportOrderIds, reportRef, setSharingReport,
    setReportOrderIds, setReportPatientId, setAiInterpretation, setAiError, t,
  } = state
  const selectedReportPatient = reportPatientId
    ? store.patients.find((patient) => patient.id === reportPatientId)
    : undefined
  const selectedPatientOrders = reportPatientId
    ? store.orders.filter((order) => order.patientId === reportPatientId && (!reportOrderIds || reportOrderIds.includes(order.id)))
    : []

  const openPatientReport = (patientId: string) => {
    setReportOrderIds(null)
    setReportPatientId(patientId)
    setAiInterpretation(null)
    setAiError('')
  }

  const openTestReport = (patientId: string, orderIds: string[] | null) => {
    setReportOrderIds(orderIds)
    setReportPatientId(patientId)
    setAiInterpretation(null)
    setAiError('')
  }

  const printPatientReport = () => {
    const printedOrderIds = new Set(selectedPatientOrders.map((order) => order.id))
    window.print()
    if (!window.confirm(t('Was this report printed successfully?'))) return
    const printedAt = new Date().toISOString()
    persist({
      ...store,
      orders: store.orders.map((order) => printedOrderIds.has(order.id) ? { ...order, printedAt } : order),
    })
  }

  const sharePatientReportOnWhatsApp = async () => {
    if (!selectedReportPatient) return
    const phoneDigits = selectedReportPatient.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      notify('Enter a valid patient phone number before sharing this report.')
      return
    }
    const phone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits
    if (!window.confirm(t('This creates a PDF containing confidential health information. Review the recipient before sharing it on WhatsApp.'))) return
    if (!reportRef.current) {
      notify('Could not create the PDF report. Try Print report and save as PDF.')
      return
    }

    const fileShareSupported = typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([], 'report.pdf', { type: 'application/pdf' })] })
    const whatsAppWindow = fileShareSupported ? null : window.open('', '_blank')
    let pdfContainer: HTMLDivElement | null = null
    setSharingReport(true)

    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const reportClone = reportRef.current.cloneNode(true) as HTMLDivElement
      reportClone.querySelector('.ai-controls')?.remove()
      const resultsScroll = reportClone.querySelector<HTMLElement>('.report-results-scroll')
      if (resultsScroll) resultsScroll.style.overflow = 'visible'

      pdfContainer = document.createElement('div')
      pdfContainer.className = 'app-shell'
      pdfContainer.dataset.mode = 'light'
      pdfContainer.dataset.accent = document.querySelector<HTMLElement>('.app-shell')?.dataset.accent ?? 'mint'
      pdfContainer.style.position = 'fixed'
      pdfContainer.style.left = '-10000px'
      pdfContainer.style.top = '0'
      pdfContainer.style.width = '760px'
      pdfContainer.style.background = '#fff'
      pdfContainer.append(reportClone)
      document.body.append(pdfContainer)

      const filename = `Patient_Lab_Report_${new Date().toISOString().slice(0, 10)}.pdf`
      const pdfBlob = await html2pdf()
        .set({
          margin: 8,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(pdfContainer)
        .outputPdf('blob') as Blob
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' })

      if (fileShareSupported) {
        try {
          await navigator.share({ files: [pdfFile], title: t('Patient report') })
          notify('PDF share completed. Confirm it was sent in WhatsApp.')
          return
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return
          console.error('Unable to share the patient report PDF.', error)
        }
      }

      const downloadUrl = URL.createObjectURL(pdfBlob)
      const downloadLink = document.createElement('a')
      downloadLink.href = downloadUrl
      downloadLink.download = filename
      document.body.append(downloadLink)
      downloadLink.click()
      downloadLink.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)

      const shareUrl = `https://wa.me/${phone}?text=${encodeURIComponent(t('Please find the attached patient lab report PDF.'))}`
      if (whatsAppWindow) {
        whatsAppWindow.location.href = shareUrl
        notify('The PDF was downloaded. Attach it in WhatsApp before sending.')
      } else {
        notify('The PDF was downloaded. Open WhatsApp, attach it, and send it to the patient.')
      }
    } catch (error) {
      console.error('Unable to create the patient report PDF.', error)
      whatsAppWindow?.close()
      notify('Could not create the PDF report. Try Print report and save as PDF.')
    } finally {
      pdfContainer?.remove()
      setSharingReport(false)
    }
  }

  return {
    selectedReportPatient,
    selectedPatientOrders,
    openPatientReport,
    openTestReport,
    printPatientReport,
    sharePatientReportOnWhatsApp,
  }
}
