import type { ReactNode } from 'react'
import { translate, type UiLanguage } from '@/i18n'
import { Icon } from '@/shared/components/Icon'

export function Dialog({ title, onClose, children, className = '', language }: { title: string; onClose: () => void; children: ReactNode; className?: string; language: UiLanguage }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div><span className="eyebrow">PRIME AI LAB</span><h2 id="dialog-title">{title}</h2></div>
          <button className="icon-button" aria-label={translate(language, 'Close dialog')} onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </section>
    </div>
  )
}
