import { useAppContext } from '@/context/useAppContext'
import { Icon } from '@/shared/components/Icon'
import { formatDate, getPatientName, getTest, getTestParameters, getParameterResult, isParameterGroupStart } from '@/shared/utils/appUtils'

export function ReportGenerationPage() {
  const { store, uiLanguage, section, generationPatientId, setGenerationPatientId, resultDrafts, t, updateParameterResult, openTestReport, generationOrders } = useAppContext()
  return (
    <>
          {section === 'report-generation' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('PATIENT REPORTS')}</span><h1>{t('Report generation')}</h1><p>{t('Review and enter individual test parameters, then print one or all patient tests.')}</p></div></div>
              <div className="panel report-generator-panel">
                <div className="report-generator-toolbar">
                  <label className="patient-picker"><span>{t('Select patient')}</span><select value={generationPatientId} onChange={(event) => setGenerationPatientId(event.target.value)}><option value="">{t('Choose a patient')}</option>{store.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
                  {generationPatientId && <button className="button button-primary" disabled={!generationOrders.length} onClick={() => openTestReport(generationPatientId, null)}><Icon name="print" size={15} /> {t('Print all tests')}</button>}
                </div>
                {!generationPatientId && <div className="report-empty-state"><span className="stat-icon mint"><Icon name="patients" /></span><strong>{t('Select a patient to get started')}</strong><p>{t('The patient’s ordered tests and report parameters will appear here.')}</p></div>}
                {generationPatientId && <>
                  {generationOrders.length > 0
                    ? <div className="report-table-scroll"><table className="generation-table"><thead><tr><th>{t('TEST NAME')}</th><th>{t('PARAMETER')}</th><th>{t('RESULT')}</th><th>{t('UNIT')}</th><th>{t('REFERENCE RANGE')}</th><th>{t('PRINT')}</th></tr></thead><tbody>
                      {generationOrders.map((order) => {
                        const test = getTest(store, order.testId)
                        const parameters = getTestParameters(store, order)
                        return parameters.map((parameter, index) => {
                          const draftKey = `${order.id}:${parameter.id}`
                          return <tr key={`${order.id}:${parameter.id}`}>
                            {index === 0 && <td rowSpan={parameters.length}><div className="generation-test-name"><strong>{test?.name ?? t('Test removed')}</strong><small>{order.id} · {t(order.status)}</small></div></td>}
                            <td>{isParameterGroupStart(parameters, index) && <strong className="parameter-group-label">{parameter.groupName}</strong>}{parameter.name}</td>
                            <td><input className="result-input generation-result-input" aria-label={`${parameter.name} ${t('for')} ${getPatientName(store, generationPatientId)}`} placeholder={t('Enter result')} value={resultDrafts[draftKey] ?? getParameterResult(order, parameter)} onChange={(event) => updateParameterResult(order, parameter, event.target.value)} /></td>
                            <td>{parameter.unit || '—'}</td>
                            <td>{parameter.reference || '—'}</td>
                            {index === 0 && <td rowSpan={parameters.length}><div className="print-action"><button className="button button-small button-outline" onClick={() => openTestReport(generationPatientId, [order.id])}><Icon name="print" size={14} /> {t('Print test')}</button>{order.printedAt && <span className="printed-indicator" title={`${t('Report already printed')} · ${formatDate(order.printedAt, uiLanguage)}`} aria-label={t('Report already printed')}><Icon name="check" size={15} /></span>}</div></td>}
                          </tr>
                        })
                      })}
                    </tbody></table></div>
                    : <div className="report-empty-state"><span className="stat-icon amber"><Icon name="flask" /></span><strong>{t('No tests ordered for this patient')}</strong><p>{t('Add one or more tests from the Patients or Test results tab first.')}</p></div>}
                </>}
                <div className="table-footer"><span>{generationOrders.length} {t(generationOrders.length === 1 ? 'test for selected patient' : 'tests for selected patient')}</span><span>{t('Report values are saved as you enter them')}</span></div>
              </div>
              <p className="demo-notice">{t('Reports are drafts. Verify every value and have a qualified professional review before release.')}</p>
            </section>
          )}
    </>
  )
}
