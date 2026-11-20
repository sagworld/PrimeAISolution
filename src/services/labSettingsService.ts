import { requestApiJson } from '@/services/apiClient'
import type { LabProfile } from '@/shared/types'

export type LabAssetKind = 'logo' | 'signature' | 'payment-qr'
export type LabProfileFields = Pick<LabProfile, 'name' | 'address' | 'ownerName' | 'mobile'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): never {
  throw new Error('The server returned invalid lab settings.')
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : invalidResponse()
}

function parseSettingsResponse(value: unknown): LabProfile {
  if (!isRecord(value) || !isRecord(value.settings)) return invalidResponse()
  const settings = value.settings
  return {
    name: readString(settings.name),
    address: readString(settings.address),
    ownerName: readString(settings.ownerName),
    mobile: readString(settings.mobile),
    logoUrl: readString(settings.logoUrl),
    signatureUrl: readString(settings.signatureUrl),
    paymentQrUrl: readString(settings.paymentQrUrl),
  }
}

export function getLabSettings(): Promise<LabProfile> {
  return requestApiJson('/api/lab/settings', parseSettingsResponse)
}

export function saveLabSettings(settings: LabProfileFields): Promise<LabProfile> {
  return requestApiJson('/api/lab/settings', parseSettingsResponse, {
    method: 'PUT',
    body: settings,
  })
}

export function uploadLabAsset(kind: LabAssetKind, file: File): Promise<LabProfile> {
  const body = new FormData()
  body.append('file', file, file.name)
  return requestApiJson(`/api/lab/assets/${kind}`, parseSettingsResponse, {
    method: 'POST',
    body,
  })
}

export function deleteLabAsset(kind: LabAssetKind): Promise<LabProfile> {
  return requestApiJson(`/api/lab/assets/${kind}`, parseSettingsResponse, {
    method: 'DELETE',
  })
}
