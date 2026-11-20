import type { LabProfile, Store } from '@/shared/types'

export const emptyLabProfile: LabProfile = {
  name: '',
  address: '',
  ownerName: '',
  mobile: '',
  logoUrl: '',
  signatureUrl: '',
  paymentQrUrl: '',
}

export const emptyStore: Store = {
  labTechnicians: [],
  referrers: [],
  sampleCollectors: [],
  patients: [],
  tests: [],
  orders: [],
  attendance: [],
}
