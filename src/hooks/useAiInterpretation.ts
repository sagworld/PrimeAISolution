import type { LabAppState } from '@/hooks/useLabState'
import type { LabOrder, Patient } from '@/shared/types'
import { getParameterResult, getTest, getTestParameters } from '@/shared/utils/appUtils'
import { readApiJson } from '@/services/aiService'

export function useAiInterpretation(
  state: LabAppState,
  selectedReportPatient: Patient | undefined,
  selectedPatientOrders: LabOrder[],
) {
  const { aiLanguage, setAiLoading, setAiError, setAiInterpretation, store, t } = state

  const generateAiInterpretation = async () => {
    setAiLoading(true)
    setAiError('')
    setAiInterpretation(null)
    try {
      const healthResponse = await fetch('/api/health')
      const health = await readApiJson<{ available?: boolean; provider?: string; model?: string; error?: string }>(healthResponse)
      if (!healthResponse.ok || !health.available) {
        throw new Error(health.error ?? 'The configured cloud AI provider is unavailable.')
      }

      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: aiLanguage,
          patientAge: selectedReportPatient?.age ?? null,
          tests: selectedPatientOrders.map((order) => ({
            name: getTest(store, order.testId)?.name ?? 'Unknown test',
            parameters: getTestParameters(store, order).map((parameter) => ({
              name: parameter.name,
              value: getParameterResult(order, parameter).trim() || 'Not entered',
              unit: parameter.unit,
              reference: parameter.reference ?? '',
            })),
          })),
        }),
      })
      const result = await readApiJson<{ interpretation?: string; provider?: string; model?: string; error?: string }>(response)
      if (!response.ok || !result.interpretation) {
        throw new Error(result.error ?? 'Could not generate an explanation. Please try again.')
      }
      setAiInterpretation({ text: result.interpretation, model: `${result.provider ?? health.provider ?? 'Cloud AI'} · ${result.model ?? health.model ?? 'model'}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setAiError(message === 'Failed to fetch'
        ? t('AI service is unreachable. Start it with npm run ai:server and try again.')
        : t(message || 'Could not generate an explanation. Please try again.'))
    } finally {
      setAiLoading(false)
    }
  }

  return { generateAiInterpretation }
}
