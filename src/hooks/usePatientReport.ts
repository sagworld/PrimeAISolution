import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'
import { normalizeIndianMobileNumber } from '@/shared/utils/appUtils'

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

  const createPatientReportPdf = async () => {
    if (!selectedReportPatient || !reportRef.current) throw new Error('The selected patient report is not available.')
    let pdfContainer: HTMLDivElement | null = null
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

      const filename = `Lab_Report_${selectedReportPatient.id}_${new Date().toISOString().slice(0, 10)}.pdf`
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
      return { pdfBlob, filename }
    } finally {
      pdfContainer?.remove()
    }
  }

  const downloadPdf = (pdfBlob: Blob, filename: string) => {
    const downloadUrl = URL.createObjectURL(pdfBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = downloadUrl
    downloadLink.download = filename
    document.body.append(downloadLink)
    downloadLink.click()
    downloadLink.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000)
  }

  const downloadPatientReportPdf = async () => {
    if (!selectedReportPatient) return
    setSharingReport(true)
    try {
      const { pdfBlob, filename } = await createPatientReportPdf()
      downloadPdf(pdfBlob, filename)
      notify('Patient report PDF downloaded.')
    } catch (error) {
      console.error('Unable to create the patient report PDF.', error)
      notify('Could not create the PDF report. Try Print report and save as PDF.')
    } finally {
      setSharingReport(false)
    }
  }

  const sharePatientReportOnWhatsApp = async (phoneNumber: string) => {
    if (!selectedReportPatient) return
    const normalizedPhone = normalizeIndianMobileNumber(phoneNumber)
    if (!normalizedPhone) {
      notify('Enter a valid patient phone number before sharing this report.')
      return
    }
    if (!reportRef.current) {
      notify('Could not create the PDF report. Try Print report and save as PDF.')
      return
    }

    let canShareFiles = false
    try {
      canShareFiles = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && typeof File !== 'undefined'
        && navigator.canShare({ files: [new File([], 'report.pdf', { type: 'application/pdf' })] })
    } catch (error) {
      console.error('Unable to check browser PDF sharing support.', error)
    }
    const whatsAppWindow = canShareFiles ? null : window.open('about:blank', '_blank')
    setSharingReport(true)

    try {
      const { pdfBlob, filename } = await createPatientReportPdf()
      const pdfFile = typeof File === 'undefined' ? null : new File([pdfBlob], filename, { type: 'application/pdf' })
      let canShareGeneratedFile = false
      if (canShareFiles && pdfFile) {
        try {
          canShareGeneratedFile = navigator.canShare({ files: [pdfFile] })
        } catch (error) {
          console.error('Unable to check generated PDF sharing support.', error)
        }
      }
      if (canShareGeneratedFile && pdfFile) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: t('Patient report'),
            text: t('Dear Patient, your laboratory report is ready. Please find your report attached.'),
          })
          notify('Choose WhatsApp and verify the patient in the share sheet before sending.')
          return
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            notify('Sharing was cancelled. Use Download PDF if WhatsApp is unavailable.')
            return
          }
          console.error('Unable to share the patient report PDF.', error)
        }
      }

      downloadPdf(pdfBlob, filename)
      const phoneDigits = normalizedPhone.replace(/\D/g, '')
      const shareUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(t('Dear Patient, your laboratory report is ready. Please find your report attached.'))}`
      if (whatsAppWindow) {
        whatsAppWindow.location.href = shareUrl
        notify('The PDF was downloaded. Attach it in the opened patient WhatsApp chat before sending.')
      } else {
        const openedWhatsApp = window.open(shareUrl, '_blank')
        if (openedWhatsApp) {
          notify('The PDF was downloaded. Attach it in the opened patient WhatsApp chat before sending.')
        } else {
          window.location.assign(shareUrl)
        }
      }
    } catch (error) {
      console.error('Unable to create the patient report PDF.', error)
      whatsAppWindow?.close()
      notify('Could not create the PDF report. Try Print report and save as PDF.')
    } finally {
      setSharingReport(false)
    }
  }

  return {
    selectedReportPatient,
    selectedPatientOrders,
    openPatientReport,
    openTestReport,
    printPatientReport,
    downloadPatientReportPdf,
    sharePatientReportOnWhatsApp,
  }
}
