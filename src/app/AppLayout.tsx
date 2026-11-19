import { useAppContext } from '@/context/useAppContext'
import { dateLocale } from '@/i18n'
import { Icon } from '@/shared/components'
import {
  AttendancePage,
  MastersPage,
  OverviewPage,
  PatientsPage,
  ReportGenerationPage,
  ReportsPage,
  ResultsPage,
  RevenuePage,
  WorkflowDialogs,
} from '@/features'
import { accentThemes } from '@/shared/data/initialStore'
import '../styles/App.css'

export function AppLayout() {
  const { store, uiLanguage, appearance, section, setSection, administrationTab, setAdministrationTab, headAuthenticated, logoutHead, attendanceStartDate, setAttendanceStartDate, attendanceEndDate, setAttendanceEndDate, search, setSearch, toast, t, updateAppearance, changeUiLanguage, openAdministration, pendingCount } = useAppContext()
  return (
    <div className="app-shell" data-mode={appearance.mode} data-accent={appearance.accent}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection('overview') }}>
          <span className="brand-mark"><Icon name="flask" size={21} /></span>
          <span className="brand-copy"><strong>prime<span>ai</span></strong><small>LAB MANAGEMENT</small></span>
        </a>
        <div className="workspace-label">{t('WORKSPACE')}</div>
        <nav className="side-nav" aria-label={t('Main navigation')}>
          <button className={`nav-item ${section === 'overview' ? 'active' : ''}`} onClick={() => setSection('overview')}><Icon name="dashboard" /><span>{t('Overview')}</span></button>
          <div className="nav-separator" />
          <button className={`nav-item ${section === 'masters' ? 'active' : ''}`} onClick={() => setSection('masters')}><Icon name="masters" /><span>{t('Masters')}</span></button>
          <button className={`nav-item ${section === 'patients' ? 'active' : ''}`} onClick={() => setSection('patients')}><Icon name="patients" /><span>{t('Patients')}</span><span className="nav-count">{store.patients.length}</span></button>
          <button className={`nav-item ${section === 'administration' ? 'active' : ''}`} onClick={openAdministration}><Icon name="masters" /><span>{t('Administration')}</span></button>
          <button className={`nav-item ${section === 'results' ? 'active' : ''}`} onClick={() => setSection('results')}><Icon name="flask" /><span>{t('Test results')}</span>{pendingCount > 0 && <span className="nav-count warning">{pendingCount}</span>}</button>
          <button className={`nav-item ${section === 'report-generation' ? 'active' : ''}`} onClick={() => setSection('report-generation')}><Icon name="print" /><span>{t('Report generation')}</span></button>
          <button className={`nav-item ${section === 'reports' ? 'active' : ''}`} onClick={() => setSection('reports')}><Icon name="report" /><span>{t('Reports')}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon"><Icon name="spark" size={16} /></span>
            <strong>{t('Lab workspace')}</strong>
            <p>{t('Your data is saved in this browser.')}</p>
            <span className="secure-label"><span /> {t('LOCAL DEMO MODE')}</span>
          </div>
          <button className="profile-button">
            <span className="avatar">PS</span>
            <span className="profile-copy"><strong>Priya Singh</strong><small>{t('Lab administrator')}</small></span>
            <span className="profile-more">···</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span>Prime AI Lab</span><span className="crumb-slash">/</span><strong>{t(section === 'overview' ? 'Overview' : section === 'results' ? 'Test results' : section === 'report-generation' ? 'Report generation' : section === 'masters' ? 'Masters' : section === 'patients' ? 'Patients' : section === 'administration' ? 'Administration' : 'Reports')}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search patients, tests...')} aria-label={t('Search patients and tests')} /><kbd>⌘ K</kbd></label>
            <label className="ui-language-picker"><span>{t('Language')}</span><select aria-label={t('Language')} value={uiLanguage} onChange={(event) => { const language = event.target.value; if (language === 'en' || language === 'mr' || language === 'hi') changeUiLanguage(language) }}><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select></label>
            <details className="appearance-menu">
              <summary className="icon-button appearance-trigger" aria-label={t('Appearance')} title={t('Appearance')}><Icon name="palette" size={18} /></summary>
              <div className="appearance-panel">
                <div className="appearance-panel-heading"><strong>{t('Appearance')}</strong><small>{t('Personalize the app colors.')}</small></div>
                <label className="appearance-mode-picker">{t('Display mode')}<select value={appearance.mode} onChange={(event) => { const mode = event.target.value; if (mode === 'light' || mode === 'dark') updateAppearance({ ...appearance, mode }) }}><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></label>
                <div className="appearance-theme-picker"><span>{t('Accent theme')}</span><div className="theme-choice-grid" role="group" aria-label={t('Accent theme')}>
                  {accentThemes.map((theme) => <button key={theme.id} type="button" className={`theme-choice ${appearance.accent === theme.id ? 'selected' : ''}`} aria-label={t(theme.label)} aria-pressed={appearance.accent === theme.id} title={t(theme.label)} onClick={() => updateAppearance({ ...appearance, accent: theme.id })}><span className="theme-swatch" style={{ backgroundColor: theme.color }} /><small>{t(theme.label)}</small></button>)}
                </div></div>
              </div>
            </details>
            <button className="icon-button notification-button" aria-label={t('Notifications')}><Icon name="bell" size={18} /><i /></button>
            <div className="topbar-divider" />
            <span className="today-date">{new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span>
          </div>
        </header>

        <div className="page-content">
          {section === 'administration' && headAuthenticated && (
            <section className="page-section">
              <div className="administration-header">
                <div className="tab-bar administration-tabs" role="tablist" aria-label={t('Administration modules')}>
                  {(['attendance', 'revenue'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={administrationTab === tab}
                      className={administrationTab === tab ? 'selected' : ''}
                      onClick={() => setAdministrationTab(tab)}
                    >
                      {t(tab === 'attendance' ? 'Attendance' : 'Revenue')}
                    </button>
                  ))}
                </div>
                {administrationTab === 'attendance' && (
                  <div className="attendance-date-range administration-date-range">
                    <label className="attendance-date-picker"><span>{t('From date')}</span><input type="date" max={attendanceEndDate} value={attendanceStartDate} onChange={(event) => { if (event.target.value) setAttendanceStartDate(event.target.value) }} /></label>
                    <label className="attendance-date-picker"><span>{t('To date')}</span><input type="date" min={attendanceStartDate} value={attendanceEndDate} onChange={(event) => { if (event.target.value) setAttendanceEndDate(event.target.value) }} /></label>
                  </div>
                )}
                <button type="button" className="button button-outline administration-logout" onClick={logoutHead}>{t('Log out')}</button>
              </div>
            </section>
          )}
          <OverviewPage />
          <MastersPage />
          <AttendancePage />
          <PatientsPage />
          <ResultsPage />
          <ReportGenerationPage />
          <ReportsPage />
          <RevenuePage />
        </div>
      </main>

      <WorkflowDialogs />
      {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    </div>
  )
}
