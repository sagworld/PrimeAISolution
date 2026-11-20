import { useState } from 'react'
import { dateLocale } from '@/i18n'
import { useAppContext } from '@/context/useAppContext'
import { RevenueBreakdownPanel } from '@/shared/components/RevenueBreakdownPanel'
import { formatRevenue } from '@/shared/utils/appUtils'

export function RevenuePage() {
  const { uiLanguage, section, administrationTab, isOwner, revenueCategory, setRevenueCategory, revenueFromDate, setRevenueFromDate, revenueToDate, setRevenueToDate, t, revenueOrders, revenueTotal, unpricedRevenueOrders, doctorRevenue, technicianRevenue, collectorRevenue } = useAppContext()
  const [revenueNameSearch, setRevenueNameSearch] = useState('')
  const selectedBreakdown = revenueCategory === 'doctor'
    ? { title: t('Doctor / referrer'), rows: doctorRevenue }
    : revenueCategory === 'technician'
      ? { title: t('Lab technicians'), rows: technicianRevenue }
      : { title: t('Sample collectors'), rows: collectorRevenue }
  const searchTerm = revenueNameSearch.trim().toLocaleLowerCase()
  const filteredBreakdown = {
    ...selectedBreakdown,
    rows: selectedBreakdown.rows.filter((row) => row.name.toLocaleLowerCase().includes(searchTerm)),
  }
  return (
    <>
          {section === 'administration' && administrationTab === 'revenue' && isOwner && (
            <section className="page-section">
              <div className="revenue-category-toolbar">
                <div className="tab-bar revenue-category-tabs" role="tablist" aria-label={t('Revenue categories')}>
                  {([
                    ['doctor', 'Doctor / referrer'],
                    ['technician', 'Lab technicians'],
                    ['collector', 'Sample collectors'],
                  ] as const).map(([category, label]) => (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={revenueCategory === category}
                      className={revenueCategory === category ? 'selected' : ''}
                      onClick={() => { setRevenueCategory(category); setRevenueNameSearch('') }}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
                <label className="revenue-name-search">
                  <input
                    type="search"
                    list="revenue-name-options"
                    value={revenueNameSearch}
                    onChange={(event) => setRevenueNameSearch(event.target.value)}
                    placeholder={t('Search by name')}
                    aria-label={t('Search by name')}
                  />
                  <datalist id="revenue-name-options">
                    {selectedBreakdown.rows.map((row) => <option key={row.id} value={row.name} />)}
                  </datalist>
                </label>
                <div className="revenue-filter-controls">
                  <div className="revenue-date-range">
                    <label className="revenue-date-control"><span>{t('From date')}</span><input type="date" max={revenueToDate} value={revenueFromDate} onChange={(event) => { if (event.target.value) setRevenueFromDate(event.target.value) }} /></label>
                    <label className="revenue-date-control"><span>{t('To date')}</span><input type="date" min={revenueFromDate} value={revenueToDate} onChange={(event) => { if (event.target.value) setRevenueToDate(event.target.value) }} /></label>
                  </div>
                </div>
              </div>
              <RevenueBreakdownPanel title={filteredBreakdown.title} rows={filteredBreakdown.rows} language={uiLanguage} />
              <div className="stats-grid revenue-stats">
                <article className="stat-card"><span className="stat-label">{t('Total estimated revenue')}</span><strong>{formatRevenue(revenueTotal, uiLanguage)}</strong><small>{t('Based on test catalogue prices')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Test orders')}</span><strong>{revenueOrders.length.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Orders in selected period')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Orders without price')}</span><strong>{unpricedRevenueOrders.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Not included in estimated revenue')}</small></article>
              </div>
              <p className="demo-notice">{t('Revenue is estimated from current catalogue prices for orders placed in the selected period. Orders without a price are not included; this is not a payment or profit report.')}</p>
            </section>
          )}
    </>
  )
}
