import { translate, type UiLanguage } from '@/i18n'
import { dateLocale } from '@/i18n'
import type { RevenueSummaryRow } from '@/shared/types'
import { formatRevenue } from '@/shared/utils/appUtils'

export function RevenueBreakdownPanel({ title, rows, language }: { title: string; rows: RevenueSummaryRow[]; language: UiLanguage }) {
  const t = (text: string) => translate(language, text)
  return (
    <article className="panel revenue-breakdown-panel">
      <div className="panel-heading"><div><h2>{title}</h2><p>{t('Revenue by assigned staff')}</p></div></div>
      <div className="revenue-table-wrap">
        <table className="revenue-table">
          <thead><tr><th>{t('Name')}</th><th>{t('Orders')}</th><th>{t('Business')}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.orders.toLocaleString(dateLocale(language))}</td><td><strong>{formatRevenue(row.amount, language)}</strong></td></tr>)}</tbody>
        </table>
        {!rows.length && <p className="empty-message">{t('No staff found.')}</p>}
      </div>
    </article>
  )
}
