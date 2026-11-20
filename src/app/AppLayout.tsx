import { useEffect, useState } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { dateLocale } from '@/i18n'
import { Icon } from '@/shared/components'
import { RoleLoginPage } from '@/app/RoleLoginPage'
import type { Patient } from '@/shared/types'
import {
  AttendancePage,
  BillingPage,
  LabSettingsPage,
  MastersPage,
  OverviewPage,
  PatientsPage,
  ReportGenerationPage,
  ReportsPage,
  ResultsPage,
  RevenuePage,
  StoreExpenditurePage,
  WorkflowDialogs,
} from '@/features'
import { accentThemes } from '@/shared/data/initialStore'
import '../styles/App.css'

export function AppLayout() {
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null)
  const {
    authenticatedUser, authLoading, authError, dataLoading, dataError, refreshLabData, login, logout, isOwner,
    store, uiLanguage, appearance, section, setSection, administrationTab, setAdministrationTab,
    attendanceStartDate, setAttendanceStartDate, attendanceEndDate, setAttendanceEndDate,
    search, setSearch, setPatientDraft, setPatientDialog, toast, t, updateAppearance,
    changeUiLanguage, openAdministration, pendingCount,
  } = useAppContext()
  const workspaceRole = authenticatedUser?.role === 'sample-collector' ? 'sample-collector' : 'lab-technician'
  const currentCollectorId = authenticatedUser?.sampleCollectorId ?? ''
  const authenticatedUserId = authenticatedUser?.id
  const authenticatedRole = authenticatedUser?.role
  const accountRole = authenticatedUser?.role === 'owner'
    ? t('Owner')
    : authenticatedUser?.role === 'lab-technician'
      ? t('lab technician')
      : t('sample collector')

  useEffect(() => {
    if (!authenticatedUserId || !authenticatedRole) return
    setSearch('')
    setSection(authenticatedRole === 'sample-collector' ? 'patients' : 'overview')
    setAdministrationTab('attendance')
    setEditingPatientId(null)
  }, [authenticatedRole, authenticatedUserId, setAdministrationTab, setSearch, setSection])
  const editPatient = (patient: Patient) => {
    setEditingPatientId(patient.id)
    setPatientDraft({
      name: patient.name,
      age: String(patient.age),
      gender: patient.gender,
      phone: patient.phone,
      labTechnicianId: patient.labTechnicianId ?? '',
      sampleCollectorId: patient.sampleCollectorId ?? '',
      referrerId: patient.referrerId ?? '',
    })
    setPatientDialog(true)
  }
  if (authLoading) {
    return <div className="app-shell role-login-shell" data-mode={appearance.mode} data-accent={appearance.accent}>
      <main className="role-login-page"><p role="status">{t('Checking your session...')}</p></main>
    </div>
  }
  if (!authenticatedUser) {
    return <RoleLoginPage
      mode={appearance.mode}
      accent={appearance.accent}
      t={t}
      loading={authLoading}
      error={authError}
      onLogin={login}
    />
  }
  if (dataLoading || dataError) {
    return <div className="app-shell role-login-shell" data-mode={appearance.mode} data-accent={appearance.accent}>
      <main className="role-login-page">
        {dataLoading
          ? <p role="status">{t('Loading lab data...')}</p>
          : <div className="role-login-error" role="alert">
            <p>{t(dataError)}</p>
            <button type="button" className="button button-primary" onClick={() => { void refreshLabData() }}>{t('Retry')}</button>
            <button type="button" className="button button-outline" onClick={() => { void logout() }}>{t('Sign out')}</button>
          </div>}
      </main>
    </div>
  }

  return (
    <div className="app-shell" data-mode={appearance.mode} data-accent={appearance.accent} data-role={workspaceRole}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection(workspaceRole === 'lab-technician' ? 'overview' : 'patients') }}>
          <span className="brand-mark"><Icon name="flask" size={21} /></span>
          <span className="brand-copy"><strong>prime<span>ai</span></strong><small>LAB MANAGEMENT</small></span>
        </a>
        <div className="workspace-label">{t('WORKSPACE')}</div>
        <nav className="side-nav" aria-label={t('Main navigation')}>
          {workspaceRole === 'lab-technician' ? <>
            <button className={`nav-item ${section === 'overview' ? 'active' : ''}`} onClick={() => setSection('overview')}><Icon name="dashboard" /><span>{t('Overview')}</span></button>
            <div className="nav-separator" />
            <button className={`nav-item ${section === 'masters' ? 'active' : ''}`} onClick={() => setSection('masters')}><Icon name="masters" /><span>{t('Masters')}</span></button>
            <button className={`nav-item ${section === 'patients' ? 'active' : ''}`} onClick={() => setSection('patients')}><Icon name="patients" /><span>{t('Patients')}</span><span className="nav-count">{store.patients.length}</span></button>
            {isOwner && <button className={`nav-item ${section === 'administration' ? 'active' : ''}`} onClick={openAdministration}><Icon name="masters" /><span>{t('Administration')}</span></button>}
            <button className={`nav-item ${section === 'results' ? 'active' : ''}`} onClick={() => setSection('results')}><Icon name="flask" /><span>{t('Test results')}</span>{pendingCount > 0 && <span className="nav-count warning">{pendingCount}</span>}</button>
            <button className={`nav-item ${section === 'report-generation' ? 'active' : ''}`} onClick={() => setSection('report-generation')}><Icon name="print" /><span>{t('Report generation')}</span></button>
            <button className={`nav-item ${section === 'reports' ? 'active' : ''}`} onClick={() => setSection('reports')}><Icon name="report" /><span>{t('Reports')}</span></button>
            <button className={`nav-item ${section === 'billing' ? 'active' : ''}`} onClick={() => setSection('billing')}><Icon name="report" /><span>{t('Billing')}</span></button>
            <button className={`nav-item ${section === 'store-expenditure' ? 'active' : ''}`} onClick={() => setSection('store-expenditure')}><Icon name="masters" /><span>{t('Store & Expenditure')}</span></button>
            {isOwner && <button className={`nav-item ${section === 'lab-settings' ? 'active' : ''}`} onClick={() => setSection('lab-settings')}><Icon name="masters" /><span>{t('Lab settings')}</span></button>}
          </> : (
            <button className={`nav-item ${section === 'patients' ? 'active' : ''}`} onClick={() => setSection('patients')}><Icon name="patients" /><span>{t('Patients')}</span><span className="nav-count">{store.patients.length}</span></button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile-button">
            <span className="avatar">{authenticatedUser.role === 'owner' ? 'OW' : workspaceRole === 'lab-technician' ? 'LT' : 'SC'}</span>
            <span className="profile-copy"><strong>{authenticatedUser.username}</strong><small>{accountRole}</small></span>
          </button>
        </div>
      </aside>

      <main className={`main-panel ${section === 'store-expenditure' ? 'store-expenditure-main' : ''}`}>
        <header className="topbar">
          <div className="breadcrumbs"><span>Prime AI Lab</span><span className="crumb-slash">/</span><strong>{t(section === 'overview' ? 'Overview' : section === 'results' ? 'Test results' : section === 'report-generation' ? 'Report generation' : section === 'masters' ? 'Masters' : section === 'patients' ? 'Patients' : section === 'administration' ? 'Administration' : section === 'billing' ? 'Billing' : section === 'store-expenditure' ? 'Store & Expenditure' : section === 'lab-settings' ? 'Lab settings' : 'Reports')}</strong></div>
          <div className="topbar-actions">
            {workspaceRole === 'lab-technician' && <>
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
            </>}
            <div className="role-session-control">
              <span>{authenticatedUser.username}</span>
              <button type="button" className="button button-small button-outline" disabled={authLoading} onClick={() => { void logout() }}>{t('Sign out')}</button>
            </div>
          </div>
        </header>

        <div className="page-content">
          {authError && <p className="role-login-error" role="alert">{t(authError)}</p>}
          {section === 'administration' && isOwner && (
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
              </div>
            </section>
          )}
          {workspaceRole === 'lab-technician' && <>
            <OverviewPage />
            <MastersPage />
            <AttendancePage />
          </>}
          <PatientsPage
            sampleCollectorMode={workspaceRole === 'sample-collector'}
            currentCollectorId={currentCollectorId}
            onEditPatient={workspaceRole === 'lab-technician' ? editPatient : undefined}
          />
          {workspaceRole === 'lab-technician' && <>
            <ResultsPage />
            <ReportGenerationPage />
            <ReportsPage />
            <RevenuePage />
            <BillingPage />
            <StoreExpenditurePage />
            {section === 'lab-settings' && <LabSettingsPage />}
          </>}
        </div>
      </main>

      <WorkflowDialogs
        sampleCollectorMode={workspaceRole === 'sample-collector'}
        sampleCollectorId={currentCollectorId}
        editingPatientId={editingPatientId}
        onEditingPatientComplete={() => setEditingPatientId(null)}
      />
      {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    </div>
  )
}
