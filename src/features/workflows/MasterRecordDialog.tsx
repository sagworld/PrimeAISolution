import { useAppContext } from '@/context/useAppContext'
import { Dialog } from '@/shared/components/Dialog'
import { Icon } from '@/shared/components/Icon'
import { useInventory } from '@/features/store-expenditure/hooks/useInventory'
import { unitLabel } from '@/features/store-expenditure/utils'

export function MasterRecordDialog() {
  const { uiLanguage, masterDialog, setMasterDialog, masterDraft, setMasterDraft, parameterDrafts, setParameterDrafts, reagentDrafts, setReagentDrafts, t, addMaster, masterTabDetails } = useAppContext()
  const { items: inventoryItems } = useInventory()
  const availableReagents = inventoryItems.filter((item) => item.category === 'material')
  return (
    <>
      {masterDialog && <Dialog title={`${t('Add')} ${masterTabDetails[masterDialog].singular}`} onClose={() => setMasterDialog(null)} className={masterDialog === 'tests' ? 'test-master-dialog' : ''} language={uiLanguage}>
        <form className="dialog-form" onSubmit={addMaster}>
          {masterDialog === 'tests' ? <div className="test-master-fields">
            <label>{t('Test name')}<input required autoFocus value={masterDraft.name} onChange={(event) => setMasterDraft({ ...masterDraft, name: event.target.value })} placeholder={t('e.g. Vitamin D')} /></label>
            <label>{t('Category')}<input required value={masterDraft.category} onChange={(event) => setMasterDraft({ ...masterDraft, category: event.target.value })} placeholder={t('e.g. Biochemistry')} /></label>
            <label>{t('Price (₹)')}<input required type="number" min="0" value={masterDraft.price} onChange={(event) => setMasterDraft({ ...masterDraft, price: event.target.value })} placeholder="0" /></label>
          </div> : <label>{t('Full name')}<input required autoFocus value={masterDraft.name} onChange={(event) => setMasterDraft({ ...masterDraft, name: event.target.value })} placeholder={t('e.g. Maya Rao')} /></label>}
          {masterDialog === 'lab-technicians' && <label>{t('Department / specialty')}<input required value={masterDraft.specialty} onChange={(event) => setMasterDraft({ ...masterDraft, specialty: event.target.value })} placeholder={t('e.g. Hematology')} /></label>}
          {masterDialog === 'referrers' && <label>{t('Organization')}<input required value={masterDraft.organization} onChange={(event) => setMasterDraft({ ...masterDraft, organization: event.target.value })} placeholder={t('Clinic or hospital')} /></label>}
          {masterDialog === 'tests' && <>
            <div className="test-master-sections">
            <div className="test-parameter-editor">
              <div className="parameter-editor-heading"><strong>{t('Test parameters')}</strong><div className="parameter-editor-heading-actions"><button type="button" className="button button-small button-outline" onClick={() => setParameterDrafts((drafts) => [...drafts, { name: '', isGroup: true, parameters: [{ name: '', unit: '', reference: '' }] }])}><Icon name="plus" size={13} /> {t('Add group')}</button><button type="button" className="button button-small button-outline" onClick={() => setParameterDrafts((drafts) => [...drafts, { name: '', isGroup: false, parameters: [{ name: '', unit: '', reference: '' }] }])}><Icon name="plus" size={13} /> {t('Add independent parameter')}</button></div></div>
              <div className="parameter-draft-list">
              {parameterDrafts.map((group, groupIndex) => <div className={`parameter-group-draft ${group.isGroup ? 'grouped-parameter-draft' : 'standalone-parameter-draft'}`} key={groupIndex}>
                {group.isGroup && <div className="parameter-group-heading">
                  <label>{t('Group name')}<input required value={group.name} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === groupIndex ? { ...draft, name: event.target.value } : draft))} placeholder={t('e.g. RBC')} /></label>
                  <div className="parameter-group-actions">
                    <button type="button" className="button button-small button-outline" onClick={() => setParameterDrafts((drafts) => drafts.map((draft, row) => row === groupIndex ? { ...draft, parameters: [...draft.parameters, { name: '', unit: '', reference: '' }] } : draft))}><Icon name="plus" size={13} /> {t('Add parameter')}</button>
                    <button type="button" className="button button-small button-outline" aria-label={`${t('Remove group')} ${groupIndex + 1}`} disabled={parameterDrafts.length === 1} onClick={() => setParameterDrafts((drafts) => drafts.filter((_, row) => row !== groupIndex))}>{t('Remove group')}</button>
                  </div>
                </div>}
                {group.parameters.map((parameter, parameterIndex) => <div className="parameter-draft-row" key={parameterIndex}>
                  <label>{t('Parameter name')}<input required value={parameter.name} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === groupIndex ? { ...draft, parameters: draft.parameters.map((item, index) => index === parameterIndex ? { ...item, name: event.target.value } : item) } : draft))} placeholder={t('e.g. Hemoglobin')} /></label>
                  <label>{t('Unit')}<input value={parameter.unit} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === groupIndex ? { ...draft, parameters: draft.parameters.map((item, index) => index === parameterIndex ? { ...item, unit: event.target.value } : item) } : draft))} placeholder={t('e.g. g/dL')} /></label>
                  <label>{t('REFERENCE RANGE')}<input value={parameter.reference} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === groupIndex ? { ...draft, parameters: draft.parameters.map((item, index) => index === parameterIndex ? { ...item, reference: event.target.value } : item) } : draft))} placeholder={t('Optional')} /></label>
                  <button type="button" className="button button-small button-outline parameter-remove" aria-label={`${t('Remove parameter')} ${parameterIndex + 1}`} disabled={group.isGroup ? group.parameters.length === 1 : parameterDrafts.length === 1} onClick={() => group.isGroup ? setParameterDrafts((drafts) => drafts.map((draft, row) => row === groupIndex ? { ...draft, parameters: draft.parameters.filter((_, index) => index !== parameterIndex) } : draft)) : setParameterDrafts((drafts) => drafts.filter((_, row) => row !== groupIndex))}>{t('Remove')}</button>
                </div>)}
              </div>)}
              </div>
            </div>
            <div className="test-parameter-editor reagent-editor">
              <div className="parameter-editor-heading"><strong>{t('Reagents used for test')}</strong><button type="button" className="button button-small button-outline" disabled={!availableReagents.length} onClick={() => setReagentDrafts((drafts) => [...drafts, { itemId: '', quantity: '' }])}><Icon name="plus" size={13} /> {t('Add reagent')}</button></div>
              <div className="reagent-draft-list">
              {!availableReagents.length && <p className="form-intro">{t('Add material items in inventory before configuring reagents.')}</p>}
              {reagentDrafts.map((reagent, index) => {
                const selectedReagent = availableReagents.find((item) => item.id === reagent.itemId)
                return <div className="reagent-draft-row" key={index}>
                  <label>{t('Reagent name')}<select required value={reagent.itemId} onChange={(event) => setReagentDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, itemId: event.target.value } : draft))}><option value="">{t('Select a reagent')}</option>{availableReagents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  <label>{t('Unit')}<input readOnly value={selectedReagent ? unitLabel(selectedReagent.unit) : ''} /></label>
                  <label>{t('Quantity used')}<input required type="number" min="0.01" step="0.01" value={reagent.quantity} onChange={(event) => setReagentDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, quantity: event.target.value } : draft))} /></label>
                  <button type="button" className="button button-small button-outline parameter-remove" aria-label={`${t('Remove reagent')} ${index + 1}`} onClick={() => setReagentDrafts((drafts) => drafts.filter((_, row) => row !== index))}>{t('Remove')}</button>
                </div>
              })}
              </div>
            </div>
            </div>
          </>}
          {masterDialog !== 'tests' && <label>{t('Phone number')}<input value={masterDraft.phone} onChange={(event) => setMasterDraft({ ...masterDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>}
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setMasterDialog(null)}>{t('Cancel')}</button><button type="submit" className="button button-primary">{t('Add record')}</button></div>
        </form>
      </Dialog>}
    </>
  )
}
