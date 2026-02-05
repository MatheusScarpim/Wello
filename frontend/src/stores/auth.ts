import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient, authApi } from '@/api'
import { updateSocketToken } from '@/services/socket'
import type { TokenPayload } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(apiClient.getToken())
  const user = ref<TokenPayload | null>(null)
  const isLoading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  async function setToken(newToken: string | null) {
    token.value = newToken
    apiClient.setToken(newToken)
    updateSocketToken(newToken)

    if (newToken) {
      try {
        const response = await authApi.validateToken(newToken)
        if (response.success && response.data) {
          user.value = response.data
        }
      } catch {
        // Token inválido
        token.value = null
        user.value = null
        apiClient.setToken(null)
      }
    } else {
      user.value = null
    }
  }

  async function generateToken(payload: { userId: string; email: string; role: string; expiresIn?: string }) {
    isLoading.value = true
    try {
      const response = await authApi.generateToken(payload)
      if (response.success && response.data) {
        await setToken(response.data.token)
        return response.data
      }
      throw new Error(response.message || 'Erro ao gerar token')
    } finally {
      isLoading.value = false
    }
  }

  async function login(payload: { email: string; password: string; remember?: boolean; expiresIn?: string }) {
    isLoading.value = true
    try {
      const response = await authApi.login(payload)
      if (response.success && response.data) {
        // Persist token directly without extra validation call
        token.value = response.data.token
        apiClient.setToken(response.data.token)
        updateSocketToken(response.data.token)
        user.value = {
          userId: response.data.userId,
          email: response.data.email,
          role: response.data.role
        }
        return response.data
      }
      throw new Error(response.message || 'Erro ao realizar login')
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    setToken(null)
  }

  // Initialize - validate existing token
  if (token.value) {
    setToken(token.value)
  }

  return {
    token,
    user,
    isLoading,
    isAuthenticated,
    setToken,
    generateToken,
    login,
    logout
  }
})
