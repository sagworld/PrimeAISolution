import { useAppContext } from '@/context/useAppContext'
import { Dialog } from '@/shared/components/Dialog'
import { dateLocale } from '@/i18n'
import { testProfiles } from '@/shared/data/initialStore'
import type { TestProfile } from '@/shared/types'

export function TestOrderDialog() {
  const { store, uiLanguage, testDialog, setTestDialog, selectedPatientId, setSelectedPatientId, selectedTestProfile, setSelectedTestProfile, selectedTestIds, setSelectedTestIds, t, addTestOrder, selectedProfileTests } = useAppContext()
  return (
    <>
      {testDialog && <Dialog title={t('Add a test order')} onClose={() => setTestDialog(false)} language={uiLanguage}>
        <form className="dialog-form" onSubmit={addTestOrder}>
          <p className="form-intro">{t('Select a patient and profile, then choose one or more tests from that profile.')}</p>
          <label>{t('Patient')}<select required value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)}><option value="">{t('Select patient')}</option>{store.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
          <label>{t('Test profile')}<select required value={selectedTestProfile} onChange={(event) => { setSelectedTestProfile(event.target.value as TestProfile | ''); setSelectedTestIds([]) }}><option value="">{t('Select test profile')}</option>{testProfiles.map((profile) => <option key={profile.id} value={profile.id}>{t(profile.label)}</option>)}</select></label>
          <fieldset className="test-selection"><legend>{t('Tests')} <span>{selectedTestIds.length} {t('selected')}</span></legend>
            {!selectedTestProfile && <p className="empty-message">{t('Select a profile to see its tests.')}</p>}
            {selectedTestProfile && selectedProfileTests.map((test) => <label className="test-option" key={test.id}><input type="checkbox" checked={selectedTestIds.includes(test.id)} onChange={(event) => setSelectedTestIds(event.target.checked ? [...selectedTestIds, test.id] : selectedTestIds.filter((id) => id !== test.id))} /><span><strong>{test.name}</strong><small>{test.category}{test.parameters?.length ? ` · ${test.parameters.length} ${t('parameters')}` : ''}</small></span><b>{test.price ? `₹${test.price.toLocaleString(dateLocale(uiLanguage))}` : t('Price not set')}</b></label>)}
          </fieldset>
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setTestDialog(false)}>{t('Cancel')}</button><button type="submit" className="button button-primary" disabled={!selectedPatientId || !selectedTestIds.length}>{t('Add')} {selectedTestIds.length || ''} {t('Add to queue')}</button></div>
        </form>
      </Dialog>}
    </>
  )
}
