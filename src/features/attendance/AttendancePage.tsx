import { useAppContext } from '@/context/useAppContext'

export function AttendancePage() {
  const { store, section, headAuthenticated, headUsername, setHeadUsername, headPassword, setHeadPassword, headLoginError, attendanceDate, setAttendanceDate, t, loginHead, logoutHead, setTechnicianAttendance } = useAppContext()
  return (
    <>
          {section === 'attendance' && !headAuthenticated && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('RESTRICTED AREA')}</span><h1>{t('Head login')}</h1><p>{t('Log in to manage lab technician attendance.')}</p></div></div>
              <div className="attendance-login-card panel">
                <form className="dialog-form" onSubmit={loginHead}>
                  <p className="form-intro">{t('Only the lab head should access the attendance manager.')}</p>
                  <label>{t('Username')}<input required autoComplete="username" value={headUsername} onChange={(event) => setHeadUsername(event.target.value)} /></label>
                  <label>{t('Password')}<input required type="password" autoComplete="current-password" value={headPassword} onChange={(event) => setHeadPassword(event.target.value)} /></label>
                  {headLoginError && <p className="attendance-login-error" role="alert">{headLoginError}</p>}
                  <button type="submit" className="button button-primary">{t('Log in')}</button>
                </form>
                <p className="attendance-security-note">{t('Demo login only: it is not secure authentication and does not protect browser data.')}</p>
              </div>
            </section>
          )}

          {section === 'attendance' && headAuthenticated && (
            <section className="page-section">
              <div className="page-heading">
                <div><span className="eyebrow">{t('LAB WORKFLOW')}</span><h1>{t('Technician attendance')}</h1><p>{t('Manage daily attendance for lab technicians.')}</p></div>
                <button className="button button-outline" onClick={logoutHead}>{t('Log out')}</button>
              </div>
              <div className="result-cards attendance-summary">
                <div className="result-card"><span className="result-number">{store.attendance.filter((record) => record.date === attendanceDate && record.status === 'Present').length}</span><span>{t('Present')}</span></div>
                <div className="result-card"><span className="result-number">{store.attendance.filter((record) => record.date === attendanceDate && record.status === 'Absent').length}</span><span>{t('Absent')}</span></div>
                <div className="result-card"><span className="result-number">{store.attendance.filter((record) => record.date === attendanceDate && record.status === 'Leave').length}</span><span>{t('Leave')}</span></div>
                <div className="result-card"><span className="result-number">{store.labTechnicians.length - store.attendance.filter((record) => record.date === attendanceDate).length}</span><span>{t('Not marked')}</span></div>
              </div>
              <div className="panel list-panel attendance-list-panel">
                <div className="list-toolbar"><div><h2>{t('Attendance register')}</h2><p>{t('Select a status for each lab technician. Changes save in this browser.')}</p></div><label className="attendance-date-picker"><span>{t('Date')}</span><input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label></div>
                <table><thead><tr><th>{t('LAB TECHNICIAN')}</th><th>{t('DEPARTMENT / SPECIALTY')}</th><th>{t('ATTENDANCE STATUS')}</th></tr></thead><tbody>
                  {store.labTechnicians.map((technician) => {
                    const record = store.attendance.find((item) => item.labTechnicianId === technician.id && item.date === attendanceDate)
                    return <tr key={technician.id}>
                      <td><div className="person-cell"><span className="avatar">{technician.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{technician.name}</strong></div></td>
                      <td>{technician.specialty}</td>
                      <td><select className="attendance-status-select" aria-label={`${t('Attendance status for')} ${technician.name}`} value={record?.status ?? ''} onChange={(event) => {
                        const value = event.target.value
                        if (value === '' || value === 'Present' || value === 'Absent' || value === 'Leave') setTechnicianAttendance(technician.id, value)
                      }}>
                        <option value="">{t('Not marked')}</option>
                        <option value="Present">{t('Present')}</option>
                        <option value="Absent">{t('Absent')}</option>
                        <option value="Leave">{t('Leave')}</option>
                      </select></td>
                    </tr>
                  })}
                  {!store.labTechnicians.length && <tr><td className="empty-cell" colSpan={3}>{t('No lab technicians found.')}</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>{store.labTechnicians.length} {t('Lab technicians').toLowerCase()}</span><span>{t('Attendance is stored in this browser.')}</span></div>
              </div>
              <p className="demo-notice">{t('Demo login only: it is not secure authentication and does not protect browser data.')}</p>
            </section>
          )}
    </>
  )
}
