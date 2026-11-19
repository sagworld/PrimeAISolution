import { dateLocale } from '@/i18n'
import { useAppContext } from '@/context/useAppContext'
import { Icon } from '@/shared/components/Icon'
import { OrderTable } from '@/shared/components/OrderTable'

export function OverviewPage() {
  const { store, uiLanguage, section, setSection, setPatientDialog, t, openPatientReport, pendingCount, todayCount, completedCount, revenue, weeklyOrders, volumeByDay, maxDailyVolume, greeting, openTestDialog } = useAppContext()
  return (
    <>
          {section === 'overview' && (
            <section className="page-section">
              <div className="page-heading overview-heading">
                <div><span className="eyebrow">{new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()}</span><h1>{greeting}, Priya <span className="wave">✦</span></h1><p>{t('Here’s what’s happening in your lab today.')}</p></div>
                <button className="button button-primary" onClick={() => setPatientDialog(true)}><Icon name="plus" size={17} /> {t('Register patient')}</button>
              </div>

              <div className="stats-grid">
                <article className="stat-card"><div className="stat-top"><span className="stat-icon mint"><Icon name="patients" /></span><span className="stat-trend"><Icon name="trend" size={13} /> 12.5%</span></div><span className="stat-label">{t('Total patients')}</span><strong>{store.patients.length.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Registered in the system')}</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon violet"><Icon name="flask" /></span><span className="stat-trend"><Icon name="trend" size={13} /> 8.2%</span></div><span className="stat-label">{t('Tests today')}</span><strong>{todayCount.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Across all test categories')}</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><Icon name="clock" /></span><span className="stat-chip">{pendingCount} {t('need attention')}</span></div><span className="stat-label">{t('Pending results')}</span><strong>{pendingCount.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Awaiting result entry')}</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Icon name="trend" /></span><span className="stat-chip">{t('All time')}</span></div><span className="stat-label">{t('Catalogue value')}</span><strong>₹{revenue.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Based on test catalogue prices')}</small></article>
              </div>

              <div className="dashboard-grid">
                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h2>{t('Recent test activity')}</h2><p>{t('Your latest patient tests and result status.')}</p></div><button className="text-button" onClick={() => setSection('results')}>{t('View all')} <Icon name="arrow" size={15} /></button></div>
                  <OrderTable orders={store.orders.slice(0, 5)} store={store} onReport={openPatientReport} compact language={uiLanguage} />
                </article>
                <article className="panel chart-panel">
                  <div className="panel-heading"><div><h2>{t('Test volume')}</h2><p>{t('Orders received this week')}</p></div><span className="period-pill">{t('This week')} <span>⌄</span></span></div>
                  <div className="chart-summary"><strong>{weeklyOrders.length}</strong><span>{t('tests this week')}</span><span className="chart-change">{store.orders.length} {t('total')}</span></div>
                  <div className="bar-chart" aria-label="Test volume chart">
                    {volumeByDay.map((day) => <div className="bar-column" key={day.label}><div className={`bar ${day.label === new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'short' }).format(new Date()) ? 'bar-current' : ''}`} style={{ height: `${day.count ? (day.count / maxDailyVolume) * 100 : 6}%` }} title={`${day.count} ${t('test')}`} /><span>{day.label}</span></div>)}
                  </div>
                </article>
              </div>

              <div className="dashboard-grid lower-grid">
                <article className="panel quick-panel">
                  <div className="panel-heading"><div><h2>{t('Quick actions')}</h2><p>{t('Common tasks, right at your fingertips.')}</p></div></div>
                  <div className="quick-actions">
                    <button onClick={() => setPatientDialog(true)}><span className="quick-icon quick-mint"><Icon name="patients" /></span><span><strong>{t('New patient')}</strong><small>{t('Register a patient')}</small></span><Icon name="arrow" size={16} /></button>
                    <button onClick={() => openTestDialog()}><span className="quick-icon quick-violet"><Icon name="flask" /></span><span><strong>{t('Add a test')}</strong><small>{t('Create a test order')}</small></span><Icon name="arrow" size={16} /></button>
                    <button onClick={() => setSection('reports')}><span className="quick-icon quick-blue"><Icon name="report" /></span><span><strong>{t('View reports')}</strong><small>{t('Explore lab activity')}</small></span><Icon name="arrow" size={16} /></button>
                  </div>
                </article>
                <article className="panel completion-panel">
                  <div className="panel-heading"><div><h2>{t('Result completion')}</h2><p>{t('Overall test processing status.')}</p></div><span className="completion-value">{store.orders.length ? Math.round((completedCount / store.orders.length) * 100) : 0}%</span></div>
                  <div className="progress-track"><span style={{ width: `${store.orders.length ? (completedCount / store.orders.length) * 100 : 0}%` }} /></div>
                  <div className="completion-legend"><span><i className="legend-dot green-dot" /> {t('Completed')} <strong>{completedCount}</strong></span><span><i className="legend-dot amber-dot" /> {t('Pending')} <strong>{pendingCount}</strong></span></div>
                  <div className="completion-note"><span className="note-icon"><Icon name="spark" size={15} /></span><p><strong>{t('AI-assisted reporting')}</strong><br />{t('Create a structured draft from entered results. All reports require professional review.')}</p></div>
                </article>
              </div>
              <p className="demo-notice">{t('Demo workspace · Sample records are fictional. Do not enter real patient information.')}</p>
            </section>
          )}
    </>
  )
}
