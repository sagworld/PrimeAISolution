import { translate, type UiLanguage } from '@/i18n'
import type { LabOrder, Store } from '@/shared/types'
import { formatDate, getPatientName, getTest } from '@/shared/utils/appUtils'
import { Icon } from '@/shared/components/Icon'

export function OrderTable({ orders, store, onReport, compact = false, language }: { orders: LabOrder[]; store: Store; onReport: (patientId: string) => void; compact?: boolean; language: UiLanguage }) {
  const t = (text: string) => translate(language, text)
  const rows = compact ? orders.slice(0, 5) : orders
  return (
    <table className="activity-table"><thead><tr><th>{t('PATIENT')}</th><th>{t('TEST')}</th><th>{t('DATE')}</th><th>{t('Status').toUpperCase()}</th><th /></tr></thead><tbody>
      {rows.map((order) => <tr key={order.id}><td><div className="order-patient"><strong>{getPatientName(store, order.patientId)}</strong><small>{order.id}</small></div></td><td>{getTest(store, order.testId)?.name ?? t('Test removed')}</td><td>{formatDate(order.createdAt, language)}</td><td><span className={`status-pill ${order.status === 'Completed' ? 'status-complete' : 'status-pending'}`}><i />{t(order.status)}</span></td><td><button className="row-action" aria-label={`${t('Show report for')} ${getPatientName(store, order.patientId)}`} onClick={() => onReport(order.patientId)}><Icon name="arrow" size={15} /></button></td></tr>)}
      {!rows.length && <tr><td colSpan={5} className="empty-cell">{t('No activity yet. Add a patient test to get started.')}</td></tr>}
    </tbody></table>
  )
}
