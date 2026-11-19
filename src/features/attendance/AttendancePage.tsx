import { useState } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { dateLocale } from '@/i18n'
import { Dialog } from '@/shared/components'
import type { AttendanceStatus } from '@/shared/types'

export function AttendancePage() {
  const {
    store, uiLanguage, section, administrationTab, headAuthenticated, headUsername, setHeadUsername,
    headPassword, setHeadPassword, headLoginError, attendanceStartDate,
    attendanceEndDate, attendanceMarkDate, setAttendanceMarkDate,
    attendanceInfoTechnicianId, setAttendanceInfoTechnicianId,
    t, loginHead, saveTechnicianAttendance,
  } = useAppContext()
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, Record<string, AttendanceStatus | ''>>>({})
  const [attendanceInfoMonth, setAttendanceInfoMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })
  const attendanceStatusByTechnician = store.attendance
    .filter((record) => record.date === attendanceMarkDate)
    .reduce<Record<string, AttendanceStatus>>((statuses, record) => {
      statuses[record.labTechnicianId] = record.status
      return statuses
    }, {})
  const attendanceStatusDraft = attendanceDrafts[attendanceMarkDate] ?? attendanceStatusByTechnician
  const hasUnsavedAttendanceChanges = store.labTechnicians.some((technician) =>
    (attendanceStatusDraft[technician.id] ?? '') !== (attendanceStatusByTechnician[technician.id] ?? ''),
  )
  const attendanceRangeRecords = store.attendance.filter((record) =>
    record.date >= attendanceStartDate && record.date <= attendanceEndDate,
  )
  const attendanceRangeDays = Math.floor(
    (Date.parse(`${attendanceEndDate}T00:00:00Z`) - Date.parse(`${attendanceStartDate}T00:00:00Z`)) / 86_400_000,
  ) + 1
  const attendanceInfoTechnician = store.labTechnicians.find((technician) => technician.id === attendanceInfoTechnicianId) ?? null
  const [attendanceInfoYear, attendanceInfoMonthNumber] = attendanceInfoMonth.split('-').map(Number)
  const attendanceInfoMonthStart = new Date(attendanceInfoYear, attendanceInfoMonthNumber - 1, 1)
  const attendanceInfoMonthDays = new Date(attendanceInfoYear, attendanceInfoMonthNumber, 0).getDate()
  const attendanceInfoMonthRecords = attendanceInfoTechnician
    ? store.attendance.filter((record) =>
      record.labTechnicianId === attendanceInfoTechnician.id && record.date.startsWith(attendanceInfoMonth),
    )
    : []
  const attendanceInfoStatusByDate = Object.fromEntries(
    attendanceInfoMonthRecords.map((record) => [record.date, record.status]),
  ) as Record<string, AttendanceStatus>
  const attendanceInfoCounts = {
    Present: attendanceInfoMonthRecords.filter((record) => record.status === 'Present').length,
    Absent: attendanceInfoMonthRecords.filter((record) => record.status === 'Absent').length,
    Leave: attendanceInfoMonthRecords.filter((record) => record.status === 'Leave').length,
  }
  const attendanceWeekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'short' }).format(new Date(2024, 0, 7 + index)),
  )
  const attendanceCalendarCells: (number | null)[] = [
    ...Array.from({ length: attendanceInfoMonthStart.getDay() }, () => null),
    ...Array.from({ length: attendanceInfoMonthDays }, (_, index) => index + 1),
  ]
  const attendanceHistory = [...new Set(store.attendance.map((record) => record.date))]
    .sort((first, second) => first.localeCompare(second))
    .map((date) => {
      const records = store.attendance.filter((record) => record.date === date)
      const namesForStatus = (status: AttendanceStatus) => records
        .filter((record) => record.status === status)
        .map((record) => store.labTechnicians.find((technician) => technician.id === record.labTechnicianId)?.name ?? t('Unknown technician'))
      return {
        date,
        present: namesForStatus('Present'),
        absent: namesForStatus('Absent'),
        leave: namesForStatus('Leave'),
      }
    })
  return (
    <>
          {section === 'administration' && !headAuthenticated && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('RESTRICTED AREA')}</span><h1>{t('Administration login')}</h1><p>{t('Log in to access the Administration modules.')}</p></div></div>
              <div className="attendance-login-card panel">
                <form className="dialog-form" onSubmit={loginHead}>
                  <p className="form-intro">{t('Only authorized administration users should sign in.')}</p>
                  <label>{t('Username')}<input required autoComplete="username" value={headUsername} onChange={(event) => setHeadUsername(event.target.value)} /></label>
                  <label>{t('Password')}<input required type="password" autoComplete="current-password" value={headPassword} onChange={(event) => setHeadPassword(event.target.value)} /></label>
                  {headLoginError && <p className="attendance-login-error" role="alert">{headLoginError}</p>}
                  <button type="submit" className="button button-primary">{t('Log in')}</button>
                </form>
                <p className="attendance-security-note">{t('Demo login only: it is not secure authentication and does not protect browser data.')}</p>
              </div>
            </section>
          )}

          {section === 'administration' && administrationTab === 'attendance' && headAuthenticated && (
            <section className="page-section">
              <div className="result-cards attendance-summary">
                <div className="result-card"><span className="result-number">{attendanceRangeRecords.filter((record) => record.status === 'Present').length}</span><span>{t('Present')}</span></div>
                <div className="result-card"><span className="result-number">{attendanceRangeRecords.filter((record) => record.status === 'Absent').length}</span><span>{t('Absent')}</span></div>
                <div className="result-card"><span className="result-number">{attendanceRangeRecords.filter((record) => record.status === 'Leave').length}</span><span>{t('Leave')}</span></div>
                <div className="result-card"><span className="result-number">{Math.max(0, store.labTechnicians.length * attendanceRangeDays - attendanceRangeRecords.length)}</span><span>{t('Not marked')}</span></div>
              </div>
              <div className="panel list-panel attendance-list-panel">
                <div className="list-toolbar"><div><h2 id="attendance-register">{t('Attendance register')}</h2><p>{t('Choose P/A/L and click Save attendance to save.')}</p></div><div className="attendance-register-controls"><label className="attendance-date-picker"><span>{t('Attendance date')}</span><input type="date" value={attendanceMarkDate} onChange={(event) => { if (event.target.value) setAttendanceMarkDate(event.target.value) }} /></label><button type="button" className="button button-primary attendance-save-button" disabled={!hasUnsavedAttendanceChanges} onClick={() => saveTechnicianAttendance(attendanceMarkDate, attendanceStatusDraft)}>{t('Save attendance')}</button></div></div>
                <div className="attendance-register-table-wrap">
                <table><thead><tr><th>{t('LAB TECHNICIAN')}</th><th>{t('DEPARTMENT / SPECIALTY')}</th><th>{t('ATTENDANCE STATUS')}</th><th>{t('Info').toUpperCase()}</th></tr></thead><tbody>
                  {store.labTechnicians.map((technician) => {
                    return <tr key={technician.id}>
                      <td><div className="person-cell"><span className="avatar">{technician.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{technician.name}</strong></div></td>
                      <td>{technician.specialty}</td>
                      <td><div className="attendance-status-options" role="group" aria-label={`${t('Attendance status for')} ${technician.name} · ${attendanceMarkDate}`}>
                        {(['Present', 'Absent', 'Leave'] as const).map((status) => {
                          const letter = status === 'Present' ? 'P' : status === 'Absent' ? 'A' : 'L'
                          const selected = attendanceStatusDraft[technician.id] === status
                          return <button key={status} type="button" className={`attendance-status-option ${selected ? `selected status-${status.toLowerCase()}` : ''}`} aria-label={`${t(status)} (${letter})`} aria-pressed={selected} onClick={() => setAttendanceDrafts((drafts) => ({ ...drafts, [attendanceMarkDate]: { ...attendanceStatusDraft, [technician.id]: selected ? '' : status } }))}><span>{letter}</span><i aria-hidden="true" /></button>
                        })}
                      </div></td>
                      <td><button type="button" className="button button-small button-outline attendance-info-button" aria-label={`${t('Info')} ${technician.name}`} onClick={() => { setAttendanceInfoMonth(attendanceMarkDate.slice(0, 7)); setAttendanceInfoTechnicianId(technician.id) }}>{t('Info')}</button></td>
                    </tr>
                  })}
                  {!store.labTechnicians.length && <tr><td className="empty-cell" colSpan={4}>{t('No lab technicians found.')}</td></tr>}
                </tbody></table>
                </div>
                <div className="table-footer"><span>{store.labTechnicians.length} {t('Lab technicians').toLowerCase()}</span><span>{t('Attendance is stored in this browser.')}</span></div>
              </div>
              <section className="panel attendance-history-panel">
                <div className="panel-heading"><div><h2>{t('Attendance history')}</h2><p>{t('All saved attendance records by date.')}</p></div></div>
                {attendanceHistory.length
                  ? <div className="attendance-history-table-wrap"><table className="attendance-history-table"><thead><tr><th>{t('Date')}</th><th>{t('Present (P)')}</th><th>{t('Absent (A)')}</th><th>{t('Leave (L)')}</th><th>{t('Edit')}</th></tr></thead><tbody>
                      {attendanceHistory.map((day) => <tr key={day.date}><td>{new Intl.DateTimeFormat(dateLocale(uiLanguage), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day.date}T00:00:00`))}</td><td>{day.present.join(', ') || '—'}</td><td>{day.absent.join(', ') || '—'}</td><td>{day.leave.join(', ') || '—'}</td><td><button type="button" className="button button-small button-outline" aria-label={`${t('Edit attendance for')} ${day.date}`} onClick={() => { setAttendanceMarkDate(day.date); document.getElementById('attendance-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{t('Edit')}</button></td></tr>)}
                    </tbody></table></div>
                  : <p className="empty-message">{t('No attendance records saved yet.')}</p>}
              </section>
              <p className="demo-notice">{t('Demo login only: it is not secure authentication and does not protect browser data.')}</p>
            </section>
          )}
          {attendanceInfoTechnician && section === 'administration' && administrationTab === 'attendance' && headAuthenticated && (
            <Dialog
              title={`${t('Attendance summary')} · ${attendanceInfoTechnician.name}`}
              onClose={() => setAttendanceInfoTechnicianId(null)}
              className="attendance-info-dialog"
              language={uiLanguage}
            >
              <div className="attendance-month-heading">
                <button type="button" className="icon-button" aria-label={t('Previous month')} onClick={() => setAttendanceInfoMonth(`${attendanceInfoMonthNumber === 1 ? attendanceInfoYear - 1 : attendanceInfoYear}-${String(attendanceInfoMonthNumber === 1 ? 12 : attendanceInfoMonthNumber - 1).padStart(2, '0')}`)}>‹</button>
                <h3>{new Intl.DateTimeFormat(dateLocale(uiLanguage), { month: 'long', year: 'numeric' }).format(attendanceInfoMonthStart)}</h3>
                <button type="button" className="icon-button" aria-label={t('Next month')} onClick={() => setAttendanceInfoMonth(`${attendanceInfoMonthNumber === 12 ? attendanceInfoYear + 1 : attendanceInfoYear}-${String(attendanceInfoMonthNumber === 12 ? 1 : attendanceInfoMonthNumber + 1).padStart(2, '0')}`)}>›</button>
              </div>
              <div className="attendance-month-calendar" role="grid" aria-label={new Intl.DateTimeFormat(dateLocale(uiLanguage), { month: 'long', year: 'numeric' }).format(attendanceInfoMonthStart)}>
                {attendanceWeekdays.map((weekday, index) => <span className="attendance-month-weekday" role="columnheader" key={`${weekday}-${index}`}>{weekday}</span>)}
                {attendanceCalendarCells.map((day, index) => {
                  if (day === null) return <span className="attendance-month-day empty" role="gridcell" key={`empty-${index}`} />
                  const date = `${attendanceInfoMonth}-${String(day).padStart(2, '0')}`
                  const status = attendanceInfoStatusByDate[date]
                  const letter = status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status === 'Leave' ? 'L' : ''
                  return <span className={`attendance-month-day ${status ? `status-${status.toLowerCase()}` : ''}`} role="gridcell" aria-label={`${day}${status ? `, ${t(status)}` : ''}`} key={date}><span>{day}</span>{letter && <strong>{letter}</strong>}</span>
                })}
              </div>
              <div className="attendance-month-legend" aria-label={t('Attendance status')}>
                <span><i className="status-present" />{t('Present (P)')}</span>
                <span><i className="status-absent" />{t('Absent (A)')}</span>
                <span><i className="status-leave" />{t('Leave (L)')}</span>
              </div>
              <div className="attendance-info-counts">
                <div className="result-card"><span className="result-number">{attendanceInfoCounts.Present}</span><span>{t('Present (P)')}</span></div>
                <div className="result-card"><span className="result-number">{attendanceInfoCounts.Absent}</span><span>{t('Absent (A)')}</span></div>
                <div className="result-card"><span className="result-number">{attendanceInfoCounts.Leave}</span><span>{t('Leave (L)')}</span></div>
              </div>
              <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setAttendanceInfoTechnicianId(null)}>{t('Close')}</button></div>
            </Dialog>
          )}
    </>
  )
}
