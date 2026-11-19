import { useRef, useState } from 'react'
import { type UiLanguage } from '@/i18n'
import type {
  AppearanceSettings,
  ExplanationLanguage,
  MasterTab,
  OrderStatusFilter,
  ReportPeriod,
  Section,
  Store,
  TestProfile,
} from '@/shared/types'
import { dateInputValue, explanationLanguage } from '@/shared/utils/appUtils'
import { readAppearance, readStore, readUiLanguage } from '@/services/browserStorage'
import { translate } from '@/i18n'

export function useLabState() {
  const [store, setStore] = useState<Store>(readStore)
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(readUiLanguage)
  const [appearance, setAppearance] = useState<AppearanceSettings>(readAppearance)
  const [section, setSection] = useState<Section>('overview')
  const [headAuthenticated, setHeadAuthenticated] = useState(false)
  const [headUsername, setHeadUsername] = useState('')
  const [headPassword, setHeadPassword] = useState('')
  const [headLoginError, setHeadLoginError] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(() => dateInputValue())
  const [masterTab, setMasterTab] = useState<MasterTab>('lab-technicians')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('Daily')
  const [revenuePeriod, setRevenuePeriod] = useState<ReportPeriod>('Daily')
  const [revenueDate, setRevenueDate] = useState(() => dateInputValue())
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('All')
  const [search, setSearch] = useState('')
  const [patientDialog, setPatientDialog] = useState(false)
  const [testDialog, setTestDialog] = useState(false)
  const [masterDialog, setMasterDialog] = useState<MasterTab | null>(null)
  const [reportPatientId, setReportPatientId] = useState<string | null>(null)
  const [reportOrderIds, setReportOrderIds] = useState<string[] | null>(null)
  const [generationPatientId, setGenerationPatientId] = useState('')
  const [aiLanguage, setAiLanguage] = useState<ExplanationLanguage>(() => explanationLanguage(uiLanguage))
  const [aiInterpretation, setAiInterpretation] = useState<{ text: string; model: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [sharingReport, setSharingReport] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedTestProfile, setSelectedTestProfile] = useState<TestProfile | ''>('')
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [patientDraft, setPatientDraft] = useState({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
  const [masterDraft, setMasterDraft] = useState({ name: '', specialty: '', organization: '', phone: '', category: '', price: '' })
  const [parameterDrafts, setParameterDrafts] = useState([{ name: '', unit: '', reference: '' }])
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const t = (text: string) => translate(uiLanguage, text)

  return {
    store, setStore, uiLanguage, setUiLanguage, appearance, setAppearance, section, setSection,
    headAuthenticated, setHeadAuthenticated, headUsername, setHeadUsername, headPassword, setHeadPassword,
    headLoginError, setHeadLoginError, attendanceDate, setAttendanceDate, masterTab, setMasterTab,
    reportPeriod, setReportPeriod, revenuePeriod, setRevenuePeriod, revenueDate, setRevenueDate,
    orderStatusFilter, setOrderStatusFilter, search, setSearch, patientDialog, setPatientDialog,
    testDialog, setTestDialog, masterDialog, setMasterDialog, reportPatientId, setReportPatientId,
    reportOrderIds, setReportOrderIds, generationPatientId, setGenerationPatientId, aiLanguage, setAiLanguage,
    aiInterpretation, setAiInterpretation, aiLoading, setAiLoading, aiError, setAiError, sharingReport,
    setSharingReport, reportRef, selectedPatientId, setSelectedPatientId, selectedTestProfile,
    setSelectedTestProfile, selectedTestIds, setSelectedTestIds, patientDraft, setPatientDraft,
    masterDraft, setMasterDraft, parameterDrafts, setParameterDrafts, resultDrafts, setResultDrafts,
    toast, setToast, t,
  }
}

export type LabAppState = ReturnType<typeof useLabState>
