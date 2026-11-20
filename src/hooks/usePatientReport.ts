import { useCallback, useEffect, useState } from 'react'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'
import { normalizeIndianMobileNumber } from '@/shared/utils/appUtils'
import { markOrdersPrinted } from '@/services/labService'

type PreparedPatientReportPdf = {
  pdfBlob: Blob
  filename: string
  file: File | null
}

function preparePatientReportFile(pdfBlob: Blob, filename: string): PreparedPatientReportPdf {
  if (pdfBlob.size === 0) throw new Error('Generated patient report PDF is empty.')
  return {
    pdfBlob,
    filename,
    file: typeof File === 'undefined' ? null : new File([pdfBlob], filename, { type: 'application/pdf' }),
  }
}

export function usePatientReport(state: LabAppState, { notify }: AppCoreActions) {
  const {
    store, setStore, labProfile, uiLanguage, reportHeaderEnabled, aiInterpretation, aiLoading, aiError, reportPatientId, reportOrderIds, reportRef, setSharingReport,
    setReportOrderIds, setReportPatientId, setAiInterpretation, setAiError, t,
  } = state
  const selectedReportPatient = reportPatientId
    ? store.patients.find((patient) => patient.id === reportPatientId)
    : undefined
  const selectedPatientOrders = reportPatientId
    ? store.orders.filter((order) => order.patientId === reportPatientId && (!reportOrderIds || reportOrderIds.includes(order.id)))
    : []
  const selectedPatientId = selectedReportPatient?.id
  const reportContentKey = JSON.stringify({
    patient: selectedReportPatient,
    orders: selectedPatientOrders,
    labProfile,
    reportHeaderEnabled,
    uiLanguage,
    aiInterpretation,
    aiLoading,
    aiError,
  })
  const [preparedReportPdf, setPreparedReportPdf] = useState<PreparedPatientReportPdf | null>(null)
  const [reportPdfError, setReportPdfError] = useState('')
  const [preparingReportPdf, setPreparingReportPdf] = useState(false)

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
    void markOrdersPrinted([...printedOrderIds]).then((printedAt) => {
      setStore((current) => ({
        ...current,
        orders: current.orders.map((order) => printedOrderIds.has(order.id) ? { ...order, printedAt } : order),
      }))
    }).catch((reason: unknown) => {
      notify(reason instanceof Error ? reason.message : 'Unable to save the printed report status.')
    })
  }

  const createPatientReportPdf = useCallback(async () => {
    if (!selectedPatientId || !reportRef.current) throw new Error('The selected patient report is not available.')
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
      pdfContainer.style.display = 'block'
      pdfContainer.style.position = 'relative'
      pdfContainer.style.width = '760px'
      pdfContainer.style.minHeight = '0'
      pdfContainer.style.background = '#fff'
      pdfContainer.append(reportClone)

      const filename = `Lab_Report_${selectedPatientId}_${new Date().toISOString().slice(0, 10)}.pdf`
      const pdfBlob = await html2pdf()
        .set({
          margin: 8,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0, windowWidth: 760 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(pdfContainer)
        .outputPdf('blob') as Blob
      return { pdfBlob, filename }
    } finally {
      pdfContainer?.remove()
    }
  }, [reportRef, selectedPatientId])

  useEffect(() => {
    let active = true
    if (!selectedPatientId) {
      setPreparedReportPdf(null)
      setReportPdfError('')
      setPreparingReportPdf(false)
      return
    }

    setPreparedReportPdf(null)
    setReportPdfError('')
    setPreparingReportPdf(true)
    const frameId = window.requestAnimationFrame(() => {
      void createPatientReportPdf()
        .then(({ pdfBlob, filename }) => {
          if (active) setPreparedReportPdf(preparePatientReportFile(pdfBlob, filename))
        })
        .catch((error) => {
          if (!active) return
          console.error('Unable to prepare the patient report for sharing.', error)
          setReportPdfError('Could not create the PDF report. Try Print report and save as PDF.')
        })
        .finally(() => {
          if (active) setPreparingReportPdf(false)
        })
    })

    return () => {
      active = false
      window.cancelAnimationFrame(frameId)
    }
  }, [createPatientReportPdf, reportContentKey, selectedPatientId])

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

  const downloadForManualSharing = (pdf: PreparedPatientReportPdf) => {
    try {
      downloadPdf(pdf.pdfBlob, pdf.filename)
      notify('The PDF was downloaded. Open WhatsApp, attach it, and send it to the patient.')
    } catch (error) {
      console.error('Unable to download the patient report PDF after sharing failed.', error)
      notify('Could not create the PDF report. Try Print report and save as PDF.')
    }
  }

  const downloadPatientReportPdf = async () => {
    if (!selectedReportPatient) return
    setSharingReport(true)
    try {
      let preparedPdf = preparedReportPdf
      if (!preparedPdf) {
        const generatedPdf = await createPatientReportPdf()
        preparedPdf = preparePatientReportFile(generatedPdf.pdfBlob, generatedPdf.filename)
      }
      setPreparedReportPdf(preparedPdf)
      setReportPdfError('')
      downloadPdf(preparedPdf.pdfBlob, preparedPdf.filename)
      notify('Patient report PDF downloaded.')
    } catch (error) {
      console.error('Unable to create the patient report PDF.', error)
      notify('Could not create the PDF report. Try Print report and save as PDF.')
    } finally {
      setSharingReport(false)
    }
  }

  const sharePatientReportOnWhatsApp = (phoneNumber: string) => {
    if (!selectedReportPatient) return
    const normalizedPhone = normalizeIndianMobileNumber(phoneNumber)
    if (!normalizedPhone) {
      notify('Enter a valid patient phone number before sharing this report.')
      return
    }
    if (!preparedReportPdf) {
      notify('Could not create the PDF report. Try Print report and save as PDF.')
      return
    }

    let canShareFiles = false
    if (preparedReportPdf.file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      try {
        canShareFiles = navigator.canShare({ files: [preparedReportPdf.file] })
      } catch (error) {
        console.error('Unable to check browser PDF sharing support.', error)
      }
    }

    if (canShareFiles && preparedReportPdf.file) {
      try {
        const sharePromise = navigator.share({ files: [preparedReportPdf.file] })
        setSharingReport(true)
        void sharePromise
          .then(() => notify('PDF share completed. Confirm it was sent in WhatsApp.'))
          .catch((error: unknown) => {
            if (error instanceof Error && error.name === 'AbortError') {
              notify('Sharing was cancelled. Use Download PDF if WhatsApp is unavailable.')
              return
            }
            console.error('Unable to share the patient report PDF.', error)
            downloadForManualSharing(preparedReportPdf)
          })
          .finally(() => setSharingReport(false))
      } catch (error) {
        console.error('Unable to start sharing the patient report PDF.', error)
        downloadForManualSharing(preparedReportPdf)
      }
      return
    }

    const whatsAppWindow = window.open('about:blank', '_blank')
    try {
      downloadPdf(preparedReportPdf.pdfBlob, preparedReportPdf.filename)
    } catch (error) {
      whatsAppWindow?.close()
      console.error('Unable to download the patient report PDF for WhatsApp.', error)
      notify('Could not create the PDF report. Try Print report and save as PDF.')
      return
    }
    const phoneDigits = normalizedPhone.replace(/\D/g, '')
    const shareUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(t('Dear Patient, your laboratory report is ready. Please find your report attached.'))}`
    if (whatsAppWindow) {
      whatsAppWindow.location.href = shareUrl
      notify('The PDF was downloaded. Attach it in the opened patient WhatsApp chat before sending.')
    } else {
      notify('PDF downloaded. WhatsApp could not open; open the patient chat and attach it manually.')
      window.location.assign(shareUrl)
    }
  }

  return {
    selectedReportPatient,
    selectedPatientOrders,
    reportPdfReady: preparedReportPdf !== null,
    reportPdfError,
    preparingReportPdf,
    openPatientReport,
    openTestReport,
    printPatientReport,
    downloadPatientReportPdf,
    sharePatientReportOnWhatsApp,
  }
}
