import { useState } from 'react'
import { Icon } from '@/shared/components'
import type { SampleCollector } from '@/shared/types'

export type WorkspaceRole = 'lab-technician' | 'sample-collector'

type RoleLoginPageProps = {
  mode: 'light' | 'dark'
  accent: string
  sampleCollectors: SampleCollector[]
  t: (text: string) => string
  onLogin: (role: WorkspaceRole, collectorId?: string) => void
}

export function RoleLoginPage({ mode, accent, sampleCollectors, t, onLogin }: RoleLoginPageProps) {
  const [collectorLoginOpen, setCollectorLoginOpen] = useState(false)
  const [collectorId, setCollectorId] = useState(sampleCollectors[0]?.id ?? '')
  const selectedCollectorId = sampleCollectors.some((collector) => collector.id === collectorId)
    ? collectorId
    : sampleCollectors[0]?.id ?? ''

  return (
    <div className="app-shell role-login-shell" data-mode={mode} data-accent={accent}>
      <main className="role-login-page">
        <section className="role-login-card">
          <div className="role-login-brand">
            <span className="brand-mark"><Icon name="flask" size={21} /></span>
            <span className="brand-copy"><strong>prime<span>ai</span></strong><small>{t('LAB MANAGEMENT')}</small></span>
          </div>
          <span className="eyebrow">{t('Demo login')}</span>
          <h1>{t('Choose your role')}</h1>
          <p className="role-login-intro">{t('Select a role to preview the appropriate workspace.')}</p>
          <div className="role-login-options">
            <button type="button" className="role-login-option" onClick={() => onLogin('lab-technician')}>
              <span className="role-login-icon"><Icon name="flask" size={20} /></span>
              <span><strong>{t('lab technician')}</strong><small>{t('Full access to lab management tools.')}</small></span>
              <span className="role-login-arrow" aria-hidden="true">→</span>
            </button>
            <button type="button" className="role-login-option" aria-expanded={collectorLoginOpen} onClick={() => setCollectorLoginOpen((open) => !open)}>
              <span className="role-login-icon"><Icon name="patients" size={20} /></span>
              <span><strong>{t('sample collector')}</strong><small>{t('Register patients and add test orders only.')}</small></span>
              <span className="role-login-arrow" aria-hidden="true">{collectorLoginOpen ? '−' : '+'}</span>
            </button>
            {collectorLoginOpen && (
              <div className="role-login-collector-form">
                {sampleCollectors.length ? <>
                  <label>{t('Select sample collector')}
                    <select value={selectedCollectorId} onChange={(event) => setCollectorId(event.target.value)}>
                      {sampleCollectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}
                    </select>
                  </label>
                  <button type="button" className="button button-primary" disabled={!selectedCollectorId} onClick={() => onLogin('sample-collector', selectedCollectorId)}>{t('Log in')}</button>
                </> : <p>{t('No sample collectors are available. Add one using a Technician login first.')}</p>}
              </div>
            )}
          </div>
          <p className="role-login-notice">{t('Demo login only: it is not secure authentication and does not protect browser data.')}</p>
        </section>
      </main>
    </div>
  )
}
