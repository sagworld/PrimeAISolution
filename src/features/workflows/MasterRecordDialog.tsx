import { useAppContext } from '@/context/useAppContext'
import { Dialog } from '@/shared/components/Dialog'
import { Icon } from '@/shared/components/Icon'

export function MasterRecordDialog() {
  const { uiLanguage, masterDialog, setMasterDialog, masterDraft, setMasterDraft, parameterDrafts, setParameterDrafts, t, addMaster, masterTabDetails } = useAppContext()
  return (
    <>
      {masterDialog && <Dialog title={`${t('Add')} ${masterTabDetails[masterDialog].singular}`} onClose={() => setMasterDialog(null)} className={masterDialog === 'tests' ? 'test-master-dialog' : ''} language={uiLanguage}>
        <form className="dialog-form" onSubmit={addMaster}>
          <label>{t(masterDialog === 'tests' ? 'Test name' : 'Full name')}<input required autoFocus value={masterDraft.name} onChange={(event) => setMasterDraft({ ...masterDraft, name: event.target.value })} placeholder={t(masterDialog === 'tests' ? 'e.g. Vitamin D' : 'e.g. Maya Rao')} /></label>
          {masterDialog === 'lab-technicians' && <label>{t('Department / specialty')}<input required value={masterDraft.specialty} onChange={(event) => setMasterDraft({ ...masterDraft, specialty: event.target.value })} placeholder={t('e.g. Hematology')} /></label>}
          {masterDialog === 'referrers' && <label>{t('Organization')}<input required value={masterDraft.organization} onChange={(event) => setMasterDraft({ ...masterDraft, organization: event.target.value })} placeholder={t('Clinic or hospital')} /></label>}
          {masterDialog === 'tests' && <>
            <div className="form-row"><label>{t('Category')}<input required value={masterDraft.category} onChange={(event) => setMasterDraft({ ...masterDraft, category: event.target.value })} placeholder={t('e.g. Biochemistry')} /></label><label>{t('Price (₹)')}<input required type="number" min="0" value={masterDraft.price} onChange={(event) => setMasterDraft({ ...masterDraft, price: event.target.value })} placeholder="0" /></label></div>
            <div className="test-parameter-editor">
              <div className="parameter-editor-heading"><strong>{t('Test parameters')}</strong><button type="button" className="button button-small button-outline" onClick={() => setParameterDrafts((drafts) => [...drafts, { name: '', unit: '', reference: '' }])}><Icon name="plus" size={13} /> {t('Add parameter')}</button></div>
              {parameterDrafts.map((parameter, index) => <div className="parameter-draft-row" key={index}>
                <label>{t('Parameter name')}<input required value={parameter.name} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, name: event.target.value } : draft))} placeholder={t('e.g. Hemoglobin')} /></label>
                <label>{t('Unit')}<input value={parameter.unit} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, unit: event.target.value } : draft))} placeholder={t('e.g. g/dL')} /></label>
                <label>{t('REFERENCE RANGE')}<input value={parameter.reference} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, reference: event.target.value } : draft))} placeholder={t('Optional')} /></label>
                <button type="button" className="button button-small button-outline parameter-remove" aria-label={`${t('Remove parameter')} ${index + 1}`} disabled={parameterDrafts.length === 1} onClick={() => setParameterDrafts((drafts) => drafts.filter((_, row) => row !== index))}>{t('Remove')}</button>
              </div>)}
            </div>
          </>}
          {masterDialog !== 'tests' && <label>{t('Phone number')}<input value={masterDraft.phone} onChange={(event) => setMasterDraft({ ...masterDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>}
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setMasterDialog(null)}>{t('Cancel')}</button><button type="submit" className="button button-primary">{t('Add record')}</button></div>
        </form>
      </Dialog>}
    </>
  )
}
