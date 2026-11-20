import type { LabOrder, TestParameter } from '@/shared/types'
import { getParameterResult, getTest, getTestParameters } from '@/shared/utils/appUtils'
import { saveOrderResults as saveOrderResultsApi } from '@/services/labService'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function useOrders(state: LabAppState, { updateStore, notify }: AppCoreActions) {
  const { store, resultDrafts, setResultDrafts } = state

  const saveOrderResults = async (order: LabOrder) => {
    const test = getTest(store, order.testId)
    const parameters = getTestParameters(store, order)
    const isParameterized = Boolean(test?.parameters?.length)
    const draftKeys = isParameterized
      ? parameters.map((parameter) => `${order.id}:${parameter.id}`)
      : [order.id]

    try {
      let savedOrder: Awaited<ReturnType<typeof saveOrderResultsApi>>
      if (isParameterized) {
        const parameterResults = Object.fromEntries(parameters.map((parameter) => {
          const draftKey = `${order.id}:${parameter.id}`
          return [parameter.id, resultDrafts[draftKey] ?? getParameterResult(order, parameter)]
        }))
        if (!Object.values(parameterResults).some((value) => value.trim())) {
          notify('Enter at least one parameter result before saving.')
          return
        }
        savedOrder = await saveOrderResultsApi(order.id, { parameterResults })
      } else {
        const result = resultDrafts[order.id]?.trim() ?? order.result.trim()
        if (!result) {
          notify('Enter a result before saving this order.')
          return
        }
        savedOrder = await saveOrderResultsApi(order.id, { result })
      }

      updateStore((current) => ({
        ...current,
        orders: current.orders.map((item) => item.id === order.id ? { ...item, ...savedOrder } : item),
      }))
      setResultDrafts((drafts) => {
        const next = { ...drafts }
        for (const key of draftKeys) delete next[key]
        return next
      })
      notify(savedOrder.status === 'Completed'
        ? 'All test results saved and reagent stock updated.'
        : isParameterized
          ? 'Parameter results saved. This test remains pending until all parameters are entered.'
          : 'Result saved.')
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Unable to save these test results.')
    }
  }

  const updateParameterResult = (order: LabOrder, parameter: TestParameter, value: string) => {
    const test = getTest(store, order.testId)
    const draftKey = test?.parameters?.length ? `${order.id}:${parameter.id}` : order.id
    setResultDrafts((drafts) => ({ ...drafts, [draftKey]: value }))
  }

  return { saveOrderResults, updateParameterResult }
}
