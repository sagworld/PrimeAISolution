import { dateLocale } from '@/i18n'
import { useAppContext } from '@/context/useAppContext'
import { RevenueBreakdownPanel } from '@/shared/components/RevenueBreakdownPanel'
import { dateInputValue, formatRevenue } from '@/shared/utils/appUtils'

export function RevenuePage() {
  const { uiLanguage, section, revenuePeriod, setRevenuePeriod, revenueDate, setRevenueDate, t, revenueOrders, revenueTotal, unpricedRevenueOrders, revenueByDay, doctorRevenue, technicianRevenue, collectorRevenue, revenueRangeLabel } = useAppContext()
  return (
    <>
          {section === 'revenue' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('REVENUE OVERVIEW')}</span><h1>{t('Revenue')}</h1><p>{t('See estimated business by date and assigned staff.')}</p></div></div>
              <div className="revenue-toolbar">
                <div className="report-period-tabs" role="group" aria-label={t('Revenue period')}>
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((period) => <button key={period} className={revenuePeriod === period ? 'selected' : ''} aria-pressed={revenuePeriod === period} onClick={() => setRevenuePeriod(period)}>{t(period)}</button>)}
                </div>
                <label className="revenue-date-control"><span>{t('Select date')}</span><input type="date" value={revenueDate} onChange={(event) => { if (event.target.value) setRevenueDate(event.target.value) }} /></label>
              </div>
              <p className="revenue-range-label">{revenueRangeLabel}</p>
              <div className="stats-grid revenue-stats">
                <article className="stat-card"><span className="stat-label">{t('Total estimated revenue')}</span><strong>{formatRevenue(revenueTotal, uiLanguage)}</strong><small>{t('Based on test catalogue prices')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Test orders')}</span><strong>{revenueOrders.length.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Orders in selected period')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Orders without price')}</span><strong>{unpricedRevenueOrders.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Not included in estimated revenue')}</small></article>
              </div>
              <article className="panel revenue-daily-panel">
                <div className="panel-heading"><div><h2>{t('Revenue by date')}</h2><p>{revenueRangeLabel}</p></div></div>
                <div className="revenue-table-wrap">
                  <table className="revenue-table revenue-date-table">
                    <thead><tr><th>{t('Date')}</th><th>{t('Test orders')}</th><th>{t('Business')}</th></tr></thead>
                    <tbody>{revenueByDay.map((day) => <tr key={dateInputValue(day.date)}><td>{new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: revenuePeriod === 'Daily' ? 'long' : 'short', day: 'numeric', month: revenuePeriod === 'Daily' ? 'long' : 'short', year: revenuePeriod === 'Daily' ? 'numeric' : undefined }).format(day.date)}</td><td>{day.orders.toLocaleString(dateLocale(uiLanguage))}</td><td><strong>{formatRevenue(day.amount, uiLanguage)}</strong></td></tr>)}</tbody>
                  </table>
                </div>
              </article>
              <div className="revenue-breakdown-grid">
                <RevenueBreakdownPanel title={t('Doctor / referrer')} rows={doctorRevenue} language={uiLanguage} />
                <RevenueBreakdownPanel title={t('Lab technicians')} rows={technicianRevenue} language={uiLanguage} />
                <RevenueBreakdownPanel title={t('Sample collectors')} rows={collectorRevenue} language={uiLanguage} />
              </div>
              <p className="demo-notice">{t('Revenue is estimated from current catalogue prices for orders placed in the selected period. Orders without a price are not included; this is not a payment or profit report.')}</p>
            </section>
          )}
    </>
  )
}
