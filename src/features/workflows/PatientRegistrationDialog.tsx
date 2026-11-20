import type { FormEvent } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { Dialog } from '@/shared/components/Dialog'

export function PatientRegistrationDialog({ sampleCollectorMode = false, sampleCollectorId = '', editingPatientId = null, onEditingComplete }: { sampleCollectorMode?: boolean; sampleCollectorId?: string; editingPatientId?: string | null; onEditingComplete?: () => void }) {
  const { store, uiLanguage, patientDialog, setPatientDialog, patientDraft, setPatientDraft, t, addPatient, updatePatient } = useAppContext()
  const isCollectorCreatedPatient = Boolean(store.patients.find((patient) => patient.id === editingPatientId)?.createdBySampleCollector)
  const closeDialog = () => {
    setPatientDialog(false)
    onEditingComplete?.()
  }
  const submitPatient = async (event: FormEvent<HTMLFormElement>) => {
    if (editingPatientId) {
      if (await updatePatient(editingPatientId, event)) onEditingComplete?.()
      return
    }
    await addPatient(event)
  }
  return (
    <>
      {patientDialog && <Dialog title={t(editingPatientId ? 'Edit patient details' : 'Register a patient')} onClose={closeDialog} language={uiLanguage}>
        <form className="dialog-form" onSubmit={submitPatient}>
          <p className="form-intro">{t(editingPatientId ? 'Update patient details and staff assignments.' : 'Register a patient profile to start adding lab tests.')}</p>
          <label>{t('Full name')}<input required autoFocus value={patientDraft.name} onChange={(event) => setPatientDraft({ ...patientDraft, name: event.target.value })} placeholder={t('e.g. Maya Sharma')} /></label>
          <div className="form-row"><label>{t('Age')}<input required type="number" min="0" max="120" value={patientDraft.age} onChange={(event) => setPatientDraft({ ...patientDraft, age: event.target.value })} placeholder={t('Age')} /></label><label>{t('Gender')}<select value={patientDraft.gender} onChange={(event) => setPatientDraft({ ...patientDraft, gender: event.target.value })}><option value="Female">{t('Female')}</option><option value="Male">{t('Male')}</option><option value="Other">{t('Other')}</option><option value="Prefer not to say">{t('Prefer not to say')}</option></select></label></div>
          <label>{t('Phone number')}<input required value={patientDraft.phone} onChange={(event) => setPatientDraft({ ...patientDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>
          {sampleCollectorMode
            ? <label>{t('sample collector')}<select disabled value={patientDraft.sampleCollectorId || sampleCollectorId}><option value="">{t('Select sample collector')}</option>{store.sampleCollectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}</select></label>
            : <div className="form-row"><label>{t('lab technician')}<select value={patientDraft.labTechnicianId} onChange={(event) => setPatientDraft({ ...patientDraft, labTechnicianId: event.target.value })}><option value="">{t('Select lab technician')}</option>{store.labTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></label><label>{t('sample collector')}<select disabled={isCollectorCreatedPatient} value={patientDraft.sampleCollectorId} onChange={(event) => setPatientDraft({ ...patientDraft, sampleCollectorId: event.target.value })}><option value="">{t('Select sample collector')}</option>{store.sampleCollectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}</select></label></div>}
          <label>{t('Referred by')}<select disabled={!sampleCollectorMode && isCollectorCreatedPatient} value={patientDraft.referrerId} onChange={(event) => setPatientDraft({ ...patientDraft, referrerId: event.target.value })}><option value="">{t('Select referrer')}</option>{store.referrers.map((referrer) => <option key={referrer.id} value={referrer.id}>{referrer.name}</option>)}</select></label>
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={closeDialog}>{t('Cancel')}</button><button type="submit" className="button button-primary">{t(editingPatientId ? 'Save changes' : 'Register patient')}</button></div>
        </form>
      </Dialog>}
    </>
  )
}
