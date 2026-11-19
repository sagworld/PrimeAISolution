import { useAppContext } from '@/context/useAppContext'
import { Dialog } from '@/shared/components/Dialog'
import { Icon } from '@/shared/components/Icon'
import { formatDate, getLabTechnician, getReferrer, getSampleCollector, getTest, getTestParameters, getParameterResult, isParameterGroupStart } from '@/shared/utils/appUtils'

export function PatientReportDialog() {
  const { store, uiLanguage, setReportPatientId, setReportOrderIds, aiLanguage, setAiLanguage, aiInterpretation, setAiInterpretation, aiLoading, aiError, setAiError, sharingReport, reportRef, t, printPatientReport, sharePatientReportOnWhatsApp, selectedReportPatient, selectedPatientOrders, generateAiInterpretation } = useAppContext()
  return (
    <>
      {selectedReportPatient && <Dialog title={t('Patient report')} onClose={() => { setReportPatientId(null); setReportOrderIds(null); setAiInterpretation(null); setAiError('') }} className="report-dialog" language={uiLanguage}>
        <div className="report-toolbar"><span className="status-pill status-complete"><i /> {t('Review before release')}</span><div className="report-toolbar-actions"><button className="button button-outline button-small" disabled={sharingReport} onClick={sharePatientReportOnWhatsApp}>{sharingReport ? t('Creating PDF…') : t('Send PDF on WhatsApp')}</button><button className="button button-outline button-small" onClick={printPatientReport}><Icon name="print" size={15} /> {t('Print report')}</button></div></div>
        <div className="printable-report" ref={reportRef}>
          <div className="report-brand"><span className="brand-mark"><Icon name="flask" size={19} /></span><div><strong>PRIME AI LAB</strong><small>{t('LABORATORY TEST REPORT')}</small></div></div>
          <div className="report-patient-info"><div><small>{t('PATIENT NAME')}</small><strong>{selectedReportPatient.name}</strong></div><div><small>{t('PATIENT ID')}</small><strong>{selectedReportPatient.id}</strong></div><div><small>{t('AGE / GENDER')}</small><strong>{selectedReportPatient.age} {t('yrs')} / {t(selectedReportPatient.gender)}</strong></div><div><small>{t('REPORT DATE')}</small><strong>{formatDate(new Date().toISOString(), uiLanguage)}</strong></div><div><small>{t('LAB TECHNICIAN')}</small><strong>{getLabTechnician(store, selectedReportPatient.labTechnicianId)}</strong></div><div><small>{t('SAMPLE COLLECTOR')}</small><strong>{getSampleCollector(store, selectedReportPatient.sampleCollectorId)}</strong></div><div><small>{t('REFERRED BY')}</small><strong>{getReferrer(store, selectedReportPatient.referrerId)}</strong></div></div>
          <div className="report-results-scroll"><table className="report-results-table"><thead><tr><th>{t('TEST')}</th><th>{t('PARAMETER')}</th><th>{t('RESULT')}</th><th>{t('UNIT')}</th><th>{t('REFERENCE RANGE')}</th><th>{t('Status').toUpperCase()}</th></tr></thead><tbody>{selectedPatientOrders.flatMap((order) => {
            const test = getTest(store, order.testId)
            const parameters = getTestParameters(store, order)
            return parameters.map((parameter, index) => <tr key={`${order.id}:${parameter.id}`}><td>{test?.name ?? t('Test removed')}</td><td>{isParameterGroupStart(parameters, index) && <strong className="parameter-group-label">{parameter.groupName}</strong>}{parameter.name}</td><td><strong>{getParameterResult(order, parameter) || t('Pending')}</strong></td><td>{parameter.unit || '—'}</td><td>{parameter.reference || '—'}</td><td>{t(order.status)}</td></tr>)
          })}</tbody></table></div>
          <section className="ai-interpretation" aria-live="polite">
            <div className="ai-interpretation-heading"><div><strong><Icon name="spark" size={15} /> {t('Plain-language explanation')}</strong><small>{t('Cloud AI · test results and age are sent; name, ID, and phone are not')}</small></div><div className="ai-controls"><label htmlFor="ai-language">{t('Language')}</label><select id="ai-language" value={aiLanguage} onChange={(event) => { const language = event.target.value; if (language === 'Marathi' || language === 'English' || language === 'Hindi') setAiLanguage(language) }}><option value="Marathi">मराठी</option><option value="English">English</option><option value="Hindi">हिन्दी</option></select><button className="button button-small button-primary" disabled={aiLoading || !selectedPatientOrders.length} onClick={generateAiInterpretation}><Icon name="spark" size={14} />{aiLoading ? t('Generating…') : t('Explain results')}</button></div></div>
            {aiError && <p className="ai-error" role="alert">{aiError}</p>}
            {aiLoading && <p className="ai-status">{t('The selected cloud AI provider is preparing a short explanation. Keep this report open.')}</p>}
            {aiInterpretation && <div className="ai-interpretation-result"><span>{t('Generated with')} {aiInterpretation.model}</span><p>{aiInterpretation.text}</p></div>}
            {!aiError && !aiLoading && !aiInterpretation && <p className="ai-status">{t('Explanation compares values with the shown ranges and may describe general possible contributors and safe next steps. It is educational, not a diagnosis or treatment; clinician review is required.')}</p>}
          </section>
          <div className="ai-disclaimer"><span><Icon name="spark" size={17} /></span><p><strong>{t('AI-assisted explanation')}</strong><br />{t('The optional AI text is educational and may be inaccurate. It is not a diagnosis or treatment advice. A qualified professional must verify results and review the report before release.')}</p></div>
          <div className="report-signoff"><span>{t('Authorized by: ____________________')}</span><span>{t('Signature: ____________________')}</span></div>
          <p className="report-footer-note">{t('Confidential laboratory record · Prepared for professional review')}</p>
        </div>
      </Dialog>}
    </>
  )
}
