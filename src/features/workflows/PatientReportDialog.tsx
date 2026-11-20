import { useEffect, useState } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { Dialog } from '@/shared/components/Dialog'
import { Icon } from '@/shared/components/Icon'
import { formatDate, getLabTechnician, getReferrer, getSampleCollector, getTest, getTestParameters, getParameterResult, isParameterGroupStart, normalizeIndianMobileNumber } from '@/shared/utils/appUtils'

export function PatientReportDialog({ sampleCollectorMode = false }: { sampleCollectorMode?: boolean }) {
  const { store, labProfile, uiLanguage, reportHeaderEnabled, setReportHeaderEnabled, setReportPatientId, setReportOrderIds, sharingReport, reportPdfReady, reportPdfError, preparingReportPdf, reportRef, t, printPatientReport, downloadPatientReportPdf, sharePatientReportOnWhatsApp, selectedReportPatient, selectedPatientOrders } = useAppContext()
  const [whatsAppNumber, setWhatsAppNumber] = useState('')
  const [whatsAppNumberError, setWhatsAppNumberError] = useState('')

  useEffect(() => {
    setWhatsAppNumber(selectedReportPatient?.phone ?? '')
    setWhatsAppNumberError('')
  }, [selectedReportPatient?.id, selectedReportPatient?.phone])

  const shareReport = () => {
    if (!normalizeIndianMobileNumber(whatsAppNumber)) {
      setWhatsAppNumberError(t('Enter a valid Indian mobile number.'))
      return
    }
    setWhatsAppNumberError('')
    void sharePatientReportOnWhatsApp(whatsAppNumber)
  }

  return (
    <>
      {selectedReportPatient && <Dialog title={t('Patient report')} onClose={() => { setReportPatientId(null); setReportOrderIds(null) }} className="report-dialog" language={uiLanguage}>
        <div className="report-toolbar">
        {sampleCollectorMode
          ? <div className="report-toolbar-actions"><button className="button button-primary button-small" disabled={!selectedPatientOrders.length || selectedPatientOrders.some((order) => order.status !== 'Completed')} onClick={printPatientReport}><Icon name="print" size={15} /> {t('Print test')}</button></div>
          : <>
            <span className="status-pill status-complete"><i /> {t('Review before release')}</span>
            <label className="report-format-picker">{t('Report format')}<select value={reportHeaderEnabled ? 'with-header' : 'without-header'} onChange={(event) => setReportHeaderEnabled(event.target.value === 'with-header')}><option value="with-header">{t('With header and footer')}</option><option value="without-header">{t('Without header and footer')}</option></select></label>
            <label className="report-share-recipient"><span>{t('WhatsApp number')}</span><input type="tel" autoComplete="tel" value={whatsAppNumber} aria-invalid={Boolean(whatsAppNumberError)} aria-describedby={whatsAppNumberError ? 'whatsapp-number-error' : undefined} onChange={(event) => { setWhatsAppNumber(event.target.value); setWhatsAppNumberError('') }} />{whatsAppNumberError && <small id="whatsapp-number-error" role="alert">{whatsAppNumberError}</small>}</label>
            <div className="report-toolbar-actions">
              <button className="button button-outline button-small" disabled={sharingReport || preparingReportPdf} onClick={downloadPatientReportPdf}><Icon name="download" size={14} /> {preparingReportPdf ? t('Creating PDF…') : t('Download PDF')}</button>
              <button className="button button-primary button-small" disabled={sharingReport || preparingReportPdf || !reportPdfReady} onClick={shareReport}><Icon name="whatsapp" size={15} /> {preparingReportPdf ? t('Creating PDF…') : sharingReport ? t('Sharing…') : t('Share on WhatsApp')}</button>
              <button className="button button-outline button-small" onClick={printPatientReport}><Icon name="print" size={15} /> {t('Print report')}</button>
            </div>
          </>}
        </div>
        {reportPdfError && <p className="ai-error" role="alert">{t(reportPdfError)}</p>}
        <div className={`printable-report${reportHeaderEnabled ? ' has-lab-header' : ''}`} ref={reportRef}>
          {reportHeaderEnabled ? <div className="lab-report-header">
            {labProfile.logoDataUrl ? <img className="lab-report-logo" src={labProfile.logoDataUrl} alt={t('Lab logo')} /> : <span className="brand-mark"><Icon name="flask" size={28} /></span>}
            <div className="lab-report-heading"><h2>{labProfile.name || 'PRIME AI LAB'}</h2><p>{labProfile.address}</p><p>{labProfile.mobile}</p><strong>{t('LABORATORY TEST REPORT')}</strong></div>
          </div> : <div className="report-brand"><span className="brand-mark"><Icon name="flask" size={19} /></span><div><strong>PRIME AI LAB</strong><small>{t('LABORATORY TEST REPORT')}</small></div></div>}
          <div className="report-patient-info"><div><small>{t('PATIENT NAME')}</small><strong>{selectedReportPatient.name}</strong></div><div><small>{t('PATIENT ID')}</small><strong>{selectedReportPatient.id}</strong></div><div><small>{t('AGE / GENDER')}</small><strong>{selectedReportPatient.age} {t('yrs')} / {t(selectedReportPatient.gender)}</strong></div><div><small>{t('REPORT DATE')}</small><strong>{formatDate(new Date().toISOString(), uiLanguage)}</strong></div><div><small>{t('SAMPLE COLLECTOR')}</small><strong>{getSampleCollector(store, selectedReportPatient.sampleCollectorId)}</strong></div>{!reportHeaderEnabled && <><div><small>{t('LAB TECHNICIAN')}</small><strong>{getLabTechnician(store, selectedReportPatient.labTechnicianId)}</strong></div><div><small>{t('REFERRED BY')}</small><strong>{getReferrer(store, selectedReportPatient.referrerId)}</strong></div></>}</div>
          <div className="report-results-scroll">{selectedPatientOrders.map((order) => {
            const test = getTest(store, order.testId)
            const parameters = getTestParameters(store, order)
            return <section className="report-test-section" key={order.id}>
              <h3 className="report-test-title">{test?.name ?? t('Test removed')}</h3>
              <table className="report-results-table">
                <thead><tr><th>{t('PARAMETER')}</th><th>{t('RESULT')}</th><th>{t('Normal range')}</th></tr></thead>
                <tbody>{parameters.map((parameter, index) => <tr key={`${order.id}:${parameter.id}`}>
                  <td>{isParameterGroupStart(parameters, index) && <strong className="parameter-group-label">{parameter.groupName} </strong>}{parameter.name}</td>
                  <td><strong>{getParameterResult(order, parameter) || t('Pending')}</strong></td>
                  <td>{parameter.reference || '—'}</td>
                </tr>)}</tbody>
              </table>
            </section>
          })}</div>
          {reportHeaderEnabled ? <div className="lab-report-footer">
            <div className="lab-report-signature">{labProfile.signatureDataUrl && <img src={labProfile.signatureDataUrl} alt={t('Owner digital signature')} />}<strong>{labProfile.ownerName || t('Owner')}</strong><small>{t('Owner')}</small></div>
            <div><strong>{getReferrer(store, selectedReportPatient.referrerId)}</strong><small>{t('Referred by')}</small></div>
            <div><strong>{getLabTechnician(store, selectedReportPatient.labTechnicianId)}</strong><small>{t('Lab technician')}</small></div>
          </div> : <><div className="report-signoff"><span>{t('Authorized by: ____________________')}</span><span>{t('Signature: ____________________')}</span></div><p className="report-footer-note">{t('Confidential laboratory record · Prepared for professional review')}</p></>}
        </div>
      </Dialog>}
    </>
  )
}
