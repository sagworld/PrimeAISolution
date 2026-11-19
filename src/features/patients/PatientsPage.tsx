import { useAppContext } from '@/context/useAppContext'
import { Icon } from '@/shared/components/Icon'
import { formatDate, getLabTechnician, getSampleCollector } from '@/shared/utils/appUtils'

export function PatientsPage() {
  const { store, uiLanguage, section, search, setSearch, setPatientDialog, t, filteredPatients, pendingCount, openTestDialog } = useAppContext()
  return (
    <>
          {section === 'patients' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('PATIENT DIRECTORY')}</span><h1>{t('Patients')}</h1><p>{t('Manage patient profiles and their requested lab tests.')}</p></div><button className="button button-primary" onClick={() => setPatientDialog(true)}><Icon name="plus" size={17} /> {t('Register patient')}</button></div>
              <div className="patient-summary-row"><div className="patient-summary"><span className="stat-icon mint"><Icon name="patients" /></span><span><small>{t('Total patients')}</small><strong>{store.patients.length}</strong></span></div><div className="patient-summary"><span className="stat-icon violet"><Icon name="flask" /></span><span><small>{t('Tests on record')}</small><strong>{store.orders.length}</strong></span></div><div className="patient-summary"><span className="stat-icon amber"><Icon name="clock" /></span><span><small>{t('Awaiting results')}</small><strong>{pendingCount}</strong></span></div></div>
              <div className="panel list-panel">
                <div className="list-toolbar"><div><h2>{t('All patients')}</h2><p>{t('A complete record of registered patients.')}</p></div><label className="table-search"><Icon name="search" size={16} /><input aria-label={t('Filter patient list')} placeholder={t('Filter patients')} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
                <table><thead><tr><th>{t('PATIENT')}</th><th>{t('PATIENT ID')}</th><th>{t('AGE / GENDER')}</th><th>{t('PHONE')}</th><th>{t('LAB TECHNICIAN')}</th><th>{t('SAMPLE COLLECTOR')}</th><th>{t('TESTS')}</th><th>{t('REGISTERED')}</th><th /></tr></thead><tbody>
                  {filteredPatients.map((patient, index) => <tr key={patient.id}><td><div className="person-cell"><span className={`avatar avatar-${index % 4}`}>{patient.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><strong>{patient.name}</strong></div></td><td><span className="id-text">{patient.id}</span></td><td>{patient.age} {t('yrs')} <span className="muted">/ {t(patient.gender)}</span></td><td>{patient.phone}</td><td>{getLabTechnician(store, patient.labTechnicianId)}</td><td>{getSampleCollector(store, patient.sampleCollectorId)}</td><td><span className="test-count">{store.orders.filter((order) => order.patientId === patient.id).length}</span></td><td>{formatDate(patient.createdAt, uiLanguage)}</td><td><button className="button button-small button-outline" onClick={() => openTestDialog(patient.id)}><Icon name="plus" size={14} /> {t('Add test')}</button></td></tr>)}
                  {!filteredPatients.length && <tr><td className="empty-cell" colSpan={9}>{t('No patients match your search.')}</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>{t('Showing')} {filteredPatients.length} {t('of')} {store.patients.length} {t('Patients').toLowerCase()}</span><span>{t('Page')} 1 of 1</span></div>
              </div>
            </section>
          )}
    </>
  )
}
