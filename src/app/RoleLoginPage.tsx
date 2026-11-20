import { useState, type FormEvent } from 'react'
import { Icon } from '@/shared/components'

type RoleLoginPageProps = {
  mode: 'light' | 'dark'
  accent: string
  t: (text: string) => string
  loading: boolean
  error: string
  onLogin: (username: string, password: string) => void
}

export function RoleLoginPage({ mode, accent, t, loading, error, onLogin }: RoleLoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLogin(username, password)
  }

  return (
    <div className="app-shell role-login-shell" data-mode={mode} data-accent={accent}>
      <main className="role-login-page">
        <section className="role-login-card">
          <div className="role-login-brand">
            <span className="brand-mark"><Icon name="flask" size={21} /></span>
            <span className="brand-copy"><strong>prime<span>ai</span></strong><small>{t('LAB MANAGEMENT')}</small></span>
          </div>
          <span className="eyebrow">{t('SECURE SIGN IN')}</span>
          <h1>{t('Sign in to your account')}</h1>
          <p className="role-login-intro">{t('Use the username and password provided by your lab owner.')}</p>
          <form className="role-login-form" onSubmit={submit}>
            <label>{t('Username')}
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>{t('Password')}
              <input
                autoComplete="current-password"
                minLength={12}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <p className="role-login-error" role="alert">{t(error)}</p>}
            <button type="submit" className="button button-primary" disabled={loading}>
              {loading ? t('Signing in...') : t('Sign in')}
            </button>
          </form>
          <p className="role-login-notice">{t('No public signup is available. Contact your lab owner if you need an account.')}</p>
        </section>
      </main>
    </div>
  )
}
