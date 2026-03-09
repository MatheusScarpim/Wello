import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'
import { queueApi } from '@/api'

export const useQueueStore = defineStore('queue', () => {
  const waitingCount = ref(0)
  let pollInterval: ReturnType<typeof setInterval> | null = null
  let socketTimeout: ReturnType<typeof setTimeout> | null = null

  async function fetchCount() {
    try {
      const response = await queueApi.getStats()
      if (response.data) {
        waitingCount.value = response.data.waiting ?? 0
      }
    } catch {
      // silent
    }
  }

  function handleSocketUpdate() {
    if (socketTimeout) clearTimeout(socketTimeout)
    socketTimeout = setTimeout(fetchCount, 800)
  }

  function startPolling() {
    if (pollInterval) return
    fetchCount()
    pollInterval = setInterval(fetchCount, 30000)
    window.addEventListener('ws:message', handleSocketUpdate)
    window.addEventListener('ws:conversation', handleSocketUpdate)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    if (socketTimeout) {
      clearTimeout(socketTimeout)
      socketTimeout = null
    }
    window.removeEventListener('ws:message', handleSocketUpdate)
    window.removeEventListener('ws:conversation', handleSocketUpdate)
  }

  return {
    waitingCount,
    fetchCount,
    startPolling,
    stopPolling,
  }
})
