<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { whatsappApi, authApi } from '@/api'
import {
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  Key,
  Shield,
  Server,
  Copy,
  Check
} from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import type { WhatsAppStatus } from '@/types'

const authStore = useAuthStore()
const toast = useToast()

const whatsappStatus = ref<WhatsAppStatus | null>(null)
const isReconnecting = ref(false)
const isDisconnecting = ref(false)
const authInfo = ref<any>(null)
const copied = ref(false)

// Token generation form
const tokenForm = ref({
  userId: '',
  email: '',
  role: 'user',
  expiresIn: '365d'
})
const generatedToken = ref('')
const isGenerating = ref(false)

async function fetchWhatsAppStatus() {
  try {
    const response = await whatsappApi.getStatus()
    if (response.data) {
      whatsappStatus.value = response.data
    }
  } catch {
    toast.error('Erro ao buscar status do WhatsApp')
  }
}

async function reconnectWhatsApp() {
  isReconnecting.value = true
  try {
    await whatsappApi.reconnect()
    toast.success('Reconexão iniciada')
    setTimeout(fetchWhatsAppStatus, 2000)
  } catch {
    toast.error('Erro ao reconectar')
  } finally {
    isReconnecting.value = false
  }
}

async function disconnectWhatsApp() {
  isDisconnecting.value = true
  try {
    await whatsappApi.disconnect()
    toast.success('WhatsApp desconectado')
    await fetchWhatsAppStatus()
  } catch {
    toast.error('Erro ao desconectar')
  } finally {
    isDisconnecting.value = false
  }
}

async function fetchAuthInfo() {
  try {
    const response = await authApi.getInfo()
    if (response.data) {
      authInfo.value = response.data
    }
  } catch {
    // Ignore
  }
}

async function generateToken() {
  if (!tokenForm.value.userId || !tokenForm.value.email) {
    toast.error('Preencha os campos obrigatórios')
    return
  }

  isGenerating.value = true
  try {
    const response = await authApi.generateToken(tokenForm.value)
    if (response.data) {
      generatedToken.value = response.data.token
      toast.success('Token gerado com sucesso')
    }
  } catch {
    toast.error('Erro ao gerar token')
  } finally {
    isGenerating.value = false
  }
}

async function copyToken() {
  if (!generatedToken.value) return
  await navigator.clipboard.writeText(generatedToken.value)
  copied.value = true
  toast.success('Token copiado!')
  setTimeout(() => { copied.value = false }, 2000)
}

onMounted(() => {
  fetchWhatsAppStatus()
  fetchAuthInfo()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Configurações</h1>
      <p class="text-gray-500">Configurações do sistema welloChat</p>
    </div>

    <!-- WhatsApp Section -->
    <div class="card">
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Wifi class="w-5 h-5 text-green-600" />
          WhatsApp
        </h2>
      </div>
      <div class="p-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center"
              :class="whatsappStatus?.connected ? 'bg-green-100' : 'bg-red-100'"
            >
              <component
                :is="whatsappStatus?.connected ? Wifi : WifiOff"
                class="w-6 h-6"
                :class="whatsappStatus?.connected ? 'text-green-600' : 'text-red-600'"
              />
            </div>
            <div>
              <p class="font-semibold text-gray-900">
                {{ whatsappStatus?.connected ? 'Conectado' : 'Desconectado' }}
              </p>
              <p class="text-sm text-gray-500">
                Status: {{ whatsappStatus?.status || 'N/A' }}
              </p>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              @click="reconnectWhatsApp"
              :disabled="isReconnecting"
              class="btn-outline"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isReconnecting }" />
              Reconectar
            </button>
            <button
              v-if="whatsappStatus?.connected"
              @click="disconnectWhatsApp"
              :disabled="isDisconnecting"
              class="btn-danger"
            >
              <Power class="w-4 h-4" />
              Desconectar
            </button>
          </div>
        </div>

        <p class="text-sm text-gray-500">
          Para conectar o WhatsApp, verifique os logs do servidor para obter o QR Code.
        </p>
      </div>
    </div>

    <!-- Auth Section -->
    <div class="card">
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Shield class="w-5 h-5 text-primary-600" />
          Autenticação
        </h2>
      </div>
      <div class="p-4 space-y-4">
        <!-- Current auth status -->
        <div class="p-4 bg-gray-50 rounded-lg">
          <p class="text-sm font-medium text-gray-700 mb-2">Status atual</p>
          <div class="flex items-center gap-2">
            <span
              :class="authStore.isAuthenticated ? 'badge-success' : 'badge-neutral'"
            >
              {{ authStore.isAuthenticated ? 'Autenticado' : 'Não autenticado' }}
            </span>
            <span v-if="authStore.user" class="text-sm text-gray-600">
              {{ authStore.user.email }} ({{ authStore.user.role }})
            </span>
          </div>
        </div>

        <!-- Auth info -->
        <div v-if="authInfo" class="p-4 bg-blue-50 rounded-lg">
          <p class="text-sm font-medium text-blue-700 mb-2">Informações de autenticação</p>
          <div class="text-xs text-blue-600 space-y-1">
            <p>Tipo: {{ authInfo.type }}</p>
            <p>Algoritmo: {{ authInfo.algorithm }}</p>
            <p>Header: {{ authInfo.header }}</p>
          </div>
        </div>

        <!-- Token generator -->
        <div class="border-t border-gray-200 pt-4">
          <h3 class="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Key class="w-4 h-4" />
            Gerar Novo Token
          </h3>

          <form @submit.prevent="generateToken" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">User ID *</label>
                <input
                  v-model="tokenForm.userId"
                  type="text"
                  class="input"
                  placeholder="user_123"
                  required
                />
              </div>
              <div>
                <label class="label">Email *</label>
                <input
                  v-model="tokenForm.email"
                  type="email"
                  class="input"
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Role</label>
                <select v-model="tokenForm.role" class="select">
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                  <option value="operator">Operador</option>
                </select>
              </div>
              <div>
                <label class="label">Expira em</label>
                <select v-model="tokenForm.expiresIn" class="select">
                  <option value="1d">1 dia</option>
                  <option value="7d">7 dias</option>
                  <option value="30d">30 dias</option>
                  <option value="365d">1 ano</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              :disabled="isGenerating"
              class="btn-primary"
            >
              {{ isGenerating ? 'Gerando...' : 'Gerar Token' }}
            </button>
          </form>

          <!-- Generated token -->
          <div v-if="generatedToken" class="mt-4 p-4 bg-green-50 rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-medium text-green-700">Token gerado</p>
              <button
                @click="copyToken"
                class="btn-ghost btn-sm text-green-600"
              >
                <component :is="copied ? Check : Copy" class="w-4 h-4" />
              </button>
            </div>
            <p class="font-mono text-xs text-green-600 break-all">
              {{ generatedToken }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- API Info -->
    <div class="card">
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Server class="w-5 h-5 text-gray-600" />
          API
        </h2>
      </div>
      <div class="p-4">
        <div class="space-y-2 text-sm">
          <p class="flex justify-between">
            <span class="text-gray-500">Documentação Swagger</span>
            <a href="/api/docs" target="_blank" class="text-primary-600 hover:underline">
              /api/docs
            </a>
          </p>
          <p class="flex justify-between">
            <span class="text-gray-500">OpenAPI JSON</span>
            <a href="/api/docs.json" target="_blank" class="text-primary-600 hover:underline">
              /api/docs.json
            </a>
          </p>
          <p class="flex justify-between">
            <span class="text-gray-500">Health Check</span>
            <a href="/health" target="_blank" class="text-primary-600 hover:underline">
              /health
            </a>
          </p>
          <p class="flex justify-between">
            <span class="text-gray-500">Status</span>
            <a href="/status" target="_blank" class="text-primary-600 hover:underline">
              /status
            </a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

