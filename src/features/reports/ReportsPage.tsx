import { dateLocale } from '@/i18n'
import { useAppContext } from '@/context/useAppContext'
import { Icon } from '@/shared/components/Icon'
import { OrderTable } from '@/shared/components/OrderTable'
import { getTest } from '@/shared/utils/appUtils'

export function ReportsPage() {
  const { store, uiLanguage, section, reportPeriod, setReportPeriod, t, openPatientReport, filteredReports } = useAppContext()
  return (
    <>
          {section === 'reports' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('INSIGHTS & DOCUMENTS')}</span><h1>{t('Reports')}</h1><p>{t('Review report collection, activity trends and lab performance.')}</p></div><button className="button button-outline" onClick={() => window.print()}><Icon name="download" size={16} /> {t('Export / print')}</button></div>
              <div className="report-period-tabs">{(['Daily', 'Weekly', 'Monthly'] as const).map((period) => <button key={period} className={reportPeriod === period ? 'selected' : ''} onClick={() => setReportPeriod(period)}>{t(period)}</button>)}</div>
              <div className="stats-grid report-stats">
                <article className="stat-card"><span className="stat-label">{t(reportPeriod)} {t('collections')}</span><strong>{filteredReports.length}</strong><small>{t('Test orders in selected period')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Completed reports')}</span><strong>{filteredReports.filter((order) => order.status === 'Completed').length}</strong><small>{t('Ready for review and printing')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Awaiting results')}</span><strong>{filteredReports.filter((order) => order.status === 'Pending').length}</strong><small>{t('Pending in selected period')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Collection value')}</span><strong>₹{filteredReports.reduce((sum, order) => sum + (getTest(store, order.testId)?.price ?? 0), 0).toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Estimated from catalogue prices')}</small></article>
              </div>
              <div className="dashboard-grid report-grid">
                <article className="panel report-collection">
                  <div className="panel-heading"><div><h2>{t(reportPeriod)} {t('report collection')}</h2><p>{t('Open a patient report for review or printing.')}</p></div><span className="period-pill">{t(reportPeriod)} <span>⌄</span></span></div>
                  <OrderTable orders={filteredReports} store={store} onReport={openPatientReport} compact language={uiLanguage} />
                  {!filteredReports.length && <p className="empty-message">{t('No orders found for this period.')}</p>}
                </article>
                <article className="panel analysis-panel">
                  <div className="panel-heading"><div><h2>{t('Analysis')}</h2><p>{t('Test category distribution')}</p></div><span className="chart-icon"><Icon name="trend" size={17} /></span></div>
                  {Array.from(new Set(store.tests.map((test) => test.category))).slice(0, 4).map((category, index) => {
                    const count = store.orders.filter((order) => getTest(store, order.testId)?.category === category).length
                    const percent = store.orders.length ? (count / store.orders.length) * 100 : 0
                    return <div className="analysis-row" key={category}><div><span>{category}</span><strong>{count} {t('test')}</strong></div><div className="analysis-track"><span className={`analysis-fill fill-${index}`} style={{ width: `${Math.max(percent, 4)}%` }} /></div></div>
                  })}
                  <div className="analysis-foot"><span>{t('Based on')} {store.orders.length} {t('orders')}</span><span><Icon name="trend" size={13} /> {t('Live')}</span></div>
                </article>
              </div>
              <p className="demo-notice">{t('Reports and analytics are based on the records currently saved in this browser.')}</p>
            </section>
          )}
    </>
  )
}
