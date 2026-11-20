import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { Icon } from '@/shared/components/Icon'
import { deleteLabAsset, saveLabSettings, uploadLabAsset } from '@/services/labSettingsService'
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
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [removeSignature, setRemoveSignature] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const logoImage = logoPreview ?? (removeLogo ? '' : draft.logoUrl)
  const signatureImage = signaturePreview ?? (removeSignature ? '' : draft.signatureUrl)

  const updateImage = async (
    event: ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'signatureUrl',
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
      if (field === 'logoUrl') {
        setLogoFile(file)
        setLogoPreview(dataUrl)
        setRemoveLogo(false)
      } else {
        setSignatureFile(file)
        setSignaturePreview(dataUrl)
        setRemoveSignature(false)
      }
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? t(caught.message) : t('Could not read the selected image.'))
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSaving(true)
    try {
      let updated = await saveLabSettings({
        name: draft.name,
        address: draft.address,
        ownerName: draft.ownerName,
        mobile: draft.mobile,
      })
      setLabProfile(updated)
      if (removeLogo) {
        updated = await deleteLabAsset('logo')
        setLabProfile(updated)
      } else if (logoFile) {
        updated = await uploadLabAsset('logo', logoFile)
        setLabProfile(updated)
      }
      if (removeSignature) {
        updated = await deleteLabAsset('signature')
        setLabProfile(updated)
      } else if (signatureFile) {
        updated = await uploadLabAsset('signature', signatureFile)
        setLabProfile(updated)
      }
      setDraft(updated)
      setLogoFile(null)
      setSignatureFile(null)
      setLogoPreview(null)
      setSignaturePreview(null)
      setRemoveLogo(false)
      setRemoveSignature(false)
      notify('Lab settings saved.')
    } catch (caught) {
      setError(caught instanceof Error ? t(caught.message) : t('Could not save lab settings.'))
    } finally {
      setIsSaving(false)
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
            <label className="button button-outline lab-image-upload"><Icon name="download" size={15} />{t(logoImage ? 'Change logo' : 'Upload logo')}<input type="file" accept="image/png,image/jpeg" disabled={isSaving} onChange={(event) => { void updateImage(event, 'logoUrl') }} /></label>
            {logoImage && <div className="lab-image-preview"><img src={logoImage} alt={t('Lab logo preview')} /><button type="button" className="button button-small button-outline" disabled={isSaving} onClick={() => { setLogoFile(null); setLogoPreview(''); setRemoveLogo(true) }}>{t('Remove')}</button></div>}
          </div>
          <div className="lab-settings-asset">
            <div><strong>{t('Owner digital signature')}</strong><p>{t('PNG or JPG, up to 512 KB.')}</p></div>
            <label className="button button-outline lab-image-upload"><Icon name="download" size={15} />{t(signatureImage ? 'Change signature' : 'Upload signature')}<input type="file" accept="image/png,image/jpeg" disabled={isSaving} onChange={(event) => { void updateImage(event, 'signatureUrl') }} /></label>
            {signatureImage && <div className="lab-signature-preview"><img src={signatureImage} alt={t('Owner signature preview')} /><button type="button" className="button button-small button-outline" disabled={isSaving} onClick={() => { setSignatureFile(null); setSignaturePreview(''); setRemoveSignature(true) }}>{t('Remove')}</button></div>}
          </div>
        </div>
        {error && <p className="lab-settings-error" role="alert">{error}</p>}
        <div className="lab-settings-actions"><button type="submit" className="button button-primary" disabled={isSaving}><Icon name="check" size={15} />{isSaving ? t('Saving…') : t('Save lab settings')}</button></div>
      </form>
    </section>
  )
}
