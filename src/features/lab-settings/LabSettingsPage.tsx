import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { Icon } from '@/shared/components/Icon'
import { saveLabProfile } from '@/services/browserStorage'
import type { LabProfile } from '@/shared/types'

const maxImageSize = 512 * 1024

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read the selected image.'))
    }
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.readAsDataURL(file)
  })
}

export function LabSettingsPage() {
  const { labProfile, setLabProfile, notify, t } = useAppContext()
  const [draft, setDraft] = useState<LabProfile>(labProfile)
  const [error, setError] = useState('')

  const updateImage = async (
    event: ChangeEvent<HTMLInputElement>,
    field: 'logoDataUrl' | 'signatureDataUrl',
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > maxImageSize) {
      setError(t('Choose a PNG or JPG image smaller than 512 KB.'))
      return
    }
    try {
      const dataUrl = await readImageFile(file)
      setDraft((current) => ({ ...current, [field]: dataUrl }))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? t(caught.message) : t('Could not read the selected image.'))
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    try {
      saveLabProfile(draft)
      setLabProfile({ ...draft, name: draft.name.trim(), address: draft.address.trim(), ownerName: draft.ownerName.trim(), mobile: draft.mobile.trim() })
      notify('Lab settings saved.')
    } catch (caught) {
      setError(caught instanceof Error ? t(caught.message) : t('Could not save lab settings in this browser.'))
    }
  }

  return (
    <section className="page-section lab-settings-page">
      <div className="page-heading">
        <div><span className="eyebrow">{t('LAB PROFILE')}</span><h1>{t('Lab settings')}</h1><p>{t('These details appear on reports printed with the lab header.')}</p></div>
      </div>
      <form className="panel lab-settings-panel" onSubmit={submit}>
        <div className="lab-settings-grid">
          <label>{t('Lab name')}<input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>{t('Owner name')}<input required maxLength={120} value={draft.ownerName} onChange={(event) => setDraft({ ...draft, ownerName: event.target.value })} /></label>
          <label className="lab-settings-wide">{t('Lab address')}<textarea required maxLength={500} rows={3} value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
          <label>{t('Mobile number')}<input required type="tel" maxLength={40} autoComplete="tel" value={draft.mobile} onChange={(event) => setDraft({ ...draft, mobile: event.target.value })} /></label>
        </div>
        <div className="lab-settings-assets">
          <div className="lab-settings-asset">
            <div><strong>{t('Lab logo')}</strong><p>{t('PNG or JPG, up to 512 KB.')}</p></div>
            <label className="button button-outline lab-image-upload"><Icon name="download" size={15} />{t(draft.logoDataUrl ? 'Change logo' : 'Upload logo')}<input type="file" accept="image/png,image/jpeg" onChange={(event) => { void updateImage(event, 'logoDataUrl') }} /></label>
            {draft.logoDataUrl && <div className="lab-image-preview"><img src={draft.logoDataUrl} alt={t('Lab logo preview')} /><button type="button" className="button button-small button-outline" onClick={() => setDraft({ ...draft, logoDataUrl: '' })}>{t('Remove')}</button></div>}
          </div>
          <div className="lab-settings-asset">
            <div><strong>{t('Owner digital signature')}</strong><p>{t('PNG or JPG, up to 512 KB.')}</p></div>
            <label className="button button-outline lab-image-upload"><Icon name="download" size={15} />{t(draft.signatureDataUrl ? 'Change signature' : 'Upload signature')}<input type="file" accept="image/png,image/jpeg" onChange={(event) => { void updateImage(event, 'signatureDataUrl') }} /></label>
            {draft.signatureDataUrl && <div className="lab-signature-preview"><img src={draft.signatureDataUrl} alt={t('Owner signature preview')} /><button type="button" className="button button-small button-outline" onClick={() => setDraft({ ...draft, signatureDataUrl: '' })}>{t('Remove')}</button></div>}
          </div>
        </div>
        {error && <p className="lab-settings-error" role="alert">{error}</p>}
        <div className="lab-settings-actions"><button type="submit" className="button button-primary"><Icon name="check" size={15} />{t('Save lab settings')}</button></div>
      </form>
    </section>
  )
}
