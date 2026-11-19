import { useAppContext } from '@/context/useAppContext'
import { Dialog } from '@/shared/components/Dialog'

export function PatientRegistrationDialog() {
  const { store, uiLanguage, patientDialog, setPatientDialog, patientDraft, setPatientDraft, t, addPatient } = useAppContext()
  return (
    <>
      {patientDialog && <Dialog title={t('Register a patient')} onClose={() => setPatientDialog(false)} language={uiLanguage}>
        <form className="dialog-form" onSubmit={addPatient}>
          <p className="form-intro">{t('Create a profile to start adding lab tests. Demo mode only — please use fictional data.')}</p>
          <label>{t('Full name')}<input required autoFocus value={patientDraft.name} onChange={(event) => setPatientDraft({ ...patientDraft, name: event.target.value })} placeholder={t('e.g. Maya Sharma')} /></label>
          <div className="form-row"><label>{t('Age')}<input required type="number" min="0" max="120" value={patientDraft.age} onChange={(event) => setPatientDraft({ ...patientDraft, age: event.target.value })} placeholder={t('Age')} /></label><label>{t('Gender')}<select value={patientDraft.gender} onChange={(event) => setPatientDraft({ ...patientDraft, gender: event.target.value })}><option value="Female">{t('Female')}</option><option value="Male">{t('Male')}</option><option value="Other">{t('Other')}</option><option value="Prefer not to say">{t('Prefer not to say')}</option></select></label></div>
          <label>{t('Phone number')}<input required value={patientDraft.phone} onChange={(event) => setPatientDraft({ ...patientDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>
          <div className="form-row"><label>{t('lab technician')}<select value={patientDraft.labTechnicianId} onChange={(event) => setPatientDraft({ ...patientDraft, labTechnicianId: event.target.value })}><option value="">{t('Select lab technician')}</option>{store.labTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></label><label>{t('sample collector')}<select value={patientDraft.sampleCollectorId} onChange={(event) => setPatientDraft({ ...patientDraft, sampleCollectorId: event.target.value })}><option value="">{t('Select sample collector')}</option>{store.sampleCollectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}</select></label></div>
          <label>{t('Referred by')}<select value={patientDraft.referrerId} onChange={(event) => setPatientDraft({ ...patientDraft, referrerId: event.target.value })}><option value="">{t('Select referrer')}</option>{store.referrers.map((referrer) => <option key={referrer.id} value={referrer.id}>{referrer.name}</option>)}</select></label>
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setPatientDialog(false)}>{t('Cancel')}</button><button type="submit" className="button button-primary">{t('Register patient')}</button></div>
        </form>
      </Dialog>}
    </>
  )
}
