import { useAppContext } from '@/context/useAppContext'
import type { OrderStatusFilter } from '@/shared/types'
import { Icon } from '@/shared/components/Icon'
import { formatDate, getPatientName, getTest, getTestParameters, getParameterResult, isParameterGroupStart } from '@/shared/utils/appUtils'

export function ResultsPage() {
  const { store, uiLanguage, section, orderStatusFilter, setOrderStatusFilter, search, setSearch, resultDrafts, setResultDrafts, t, saveOrderResults, openPatientReport, filteredOrders, pendingCount, completedCount, openTestDialog } = useAppContext()
  return (
    <>
          {section === 'results' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('LAB WORKFLOW')}</span><h1>{t('Test results')}</h1><p>{t('Enter and review results, then prepare a patient report.')}</p></div><button className="button button-primary" onClick={() => openTestDialog()}><Icon name="plus" size={17} /> {t('Add test order')}</button></div>
              <div className="result-cards"><div className="result-card"><span className="result-number">{store.orders.length}</span><span>{t('Total orders')}</span></div><div className="result-card"><span className="result-number">{pendingCount}</span><span><i className="legend-dot amber-dot" /> {t('Pending')}</span></div><div className="result-card"><span className="result-number">{completedCount}</span><span><i className="legend-dot green-dot" /> {t('Completed')}</span></div></div>
              <div className="panel list-panel">
                <div className="list-toolbar"><div><h2>{t('Test queue')}</h2><p>{t('Results are submitted to the lab database.')}</p></div><div className="result-list-controls"><label className="status-filter">{t('Status')}<select aria-label={t('Filter tests by status')} value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as OrderStatusFilter)}><option value="All">{t('All')}</option><option value="Pending">{t('Pending')}</option><option value="Completed">{t('Completed')}</option></select></label><label className="table-search"><Icon name="search" size={16} /><input aria-label={t('Filter test orders')} placeholder={t('Filter tests')} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>
                <table><thead><tr><th>{t('ORDER / PATIENT')}</th><th>{t('TEST')}</th><th>{t('ORDERED')}</th><th>{t('RESULT')}</th><th>{t('REFERENCE')}</th><th>{t('Status').toUpperCase()}</th><th>{t('ACTIONS')}</th></tr></thead><tbody>
                  {filteredOrders.map((order) => {
                    const test = getTest(store, order.testId)
                    const parameters = getTestParameters(store, order)
                    const isParameterized = Boolean(test?.parameters?.length)
                    return <tr key={order.id}>
                      <td><div className="order-patient"><strong>{getPatientName(store, order.patientId)}</strong><small>{order.id} · {order.patientId}</small></div></td>
                      <td><strong className="normal-weight">{test?.name ?? t('Test removed')}</strong></td>
                      <td>{formatDate(order.createdAt, uiLanguage)}</td>
                      <td>{isParameterized
                        ? <div className="parameter-result-inputs">{parameters.map((parameter, index) => {
                          const draftKey = `${order.id}:${parameter.id}`
                          return <div className="parameter-result-entry" key={parameter.id}>{isParameterGroupStart(parameters, index) && <strong className="parameter-group-label">{parameter.groupName}</strong>}<label><span>{parameter.name}{parameter.unit ? ` · ${parameter.unit}` : ''}</span><input className={`result-input ${order.status === 'Completed' ? 'result-input-complete' : ''}`} aria-label={`${parameter.name} ${t('result for')} ${order.id}`} placeholder={t('Enter result')} value={resultDrafts[draftKey] ?? getParameterResult(order, parameter)} onChange={(event) => setResultDrafts({ ...resultDrafts, [draftKey]: event.target.value })} /></label></div>
                        })}</div>
                        : <input className={`result-input ${order.status === 'Completed' ? 'result-input-complete' : ''}`} aria-label={`${t('Result for')} ${order.id}`} placeholder={t('Enter result')} value={resultDrafts[order.id] ?? order.result} onChange={(event) => setResultDrafts({ ...resultDrafts, [order.id]: event.target.value })} />}
                      </td>
                      <td>{isParameterized ? t('See parameter ranges') : test?.reference ?? '—'}</td>
                      <td><span className={`status-pill ${order.status === 'Completed' ? 'status-complete' : 'status-pending'}`}><i />{t(order.status)}</span></td>
                      <td><div className="action-group"><button className="button button-small button-outline" onClick={() => saveOrderResults(order)}>{t('Save')}</button><button className="row-action" title={t('Show report')} onClick={() => openPatientReport(order.patientId)}><Icon name="report" size={16} /></button></div></td>
                    </tr>
                  })}
                  {!filteredOrders.length && <tr><td className="empty-cell" colSpan={7}>{t('No test orders match your search.')}</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>{filteredOrders.length} {t('test orders')}</span><span>{t('Results must be reviewed by qualified laboratory staff')}</span></div>
              </div>
            </section>
          )}
    </>
  )
}
