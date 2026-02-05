import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { operatorsApi, queueApi } from '@/api'
import type { Operator, OperatorStatus, QueueItem } from '@/types'

export const useOperatorStore = defineStore('operator', () => {
  const currentOperator = ref<Operator | null>(null)
  const isLoading = ref(false)
  const myQueue = ref<QueueItem[]>([])
  const queueStats = ref({
    waiting: 0,
    inProgress: 0,
    resolved: 0,
    avgWaitTime: 0
  })

  const isOnline = computed(() => currentOperator.value?.status === 'online')
  const activeChats = computed(() => currentOperator.value?.metrics.activeChats || 0)
  const canAcceptChats = computed(() => {
    if (!currentOperator.value) return false
    return activeChats.value < currentOperator.value.settings.maxConcurrentChats
  })

  async function fetchCurrentOperator() {
    isLoading.value = true
    try {
      const response = await operatorsApi.getCurrentOperator()
      if (response.data) {
        currentOperator.value = response.data
      }
      return currentOperator.value
    } catch {
      currentOperator.value = null
      return null
    } finally {
      isLoading.value = false
    }
  }

  function setCurrentOperator(operator: Operator | null) {
    currentOperator.value = operator
  }

  async function updateStatus(status: OperatorStatus) {
    if (!currentOperator.value) return

    try {
      const response = await operatorsApi.updateStatus(currentOperator.value._id, status)
      if (response.data) {
        currentOperator.value = response.data
      }
    } catch (error) {
      throw error
    }
  }

  async function fetchMyQueue() {
    if (!currentOperator.value) return

    try {
      const response = await queueApi.list({
        operatorId: currentOperator.value._id,
        status: 'in_progress'
      })
      if (response.data) {
        myQueue.value = response.data.items
      }
    } catch {
      myQueue.value = []
    }
  }

  async function fetchQueueStats() {
    try {
      const response = await queueApi.getStats()
      if (response.data) {
        queueStats.value = response.data
      }
    } catch {
      // Keep current stats
    }
  }

  async function assumeConversation(conversationId: string) {
    try {
      const response = await queueApi.assume(conversationId)
      await fetchMyQueue()
      await fetchQueueStats()
      return response.data
    } catch (error) {
      throw error
    }
  }

  async function releaseConversation(conversationId: string) {
    try {
      await queueApi.release(conversationId)
      await fetchMyQueue()
      await fetchQueueStats()
    } catch (error) {
      throw error
    }
  }

  async function resolveConversation(conversationId: string, notes?: string, finalizationIds?: string[]) {
    try {
      await queueApi.resolve(conversationId, { notes, finalizationIds })
      await fetchMyQueue()
      await fetchQueueStats()
    } catch (error) {
      throw error
    }
  }

  async function transferConversation(conversationId: string, targetType: 'department' | 'operator', targetId: string, notes?: string) {
    try {
      await queueApi.transfer({ conversationId, targetType, targetId, notes })
      await fetchMyQueue()
      await fetchQueueStats()
    } catch (error) {
      throw error
    }
  }

  function reset() {
    currentOperator.value = null
    myQueue.value = []
  }

  return {
    currentOperator,
    isLoading,
    myQueue,
    queueStats,
    isOnline,
    activeChats,
    canAcceptChats,
    fetchCurrentOperator,
    setCurrentOperator,
    updateStatus,
    fetchMyQueue,
    fetchQueueStats,
    assumeConversation,
    releaseConversation,
    resolveConversation,
    transferConversation,
    reset
  }
})
