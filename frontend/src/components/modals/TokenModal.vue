<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { X, Copy, Check } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'

const emit = defineEmits<{
  close: []
}>()

const authStore = useAuthStore()
const toast = useToast()

const mode = ref<'set' | 'generate'>('set')
const tokenInput = ref(authStore.token || '')
const copied = ref(false)

// Generate form
const generateForm = ref({
  userId: '',
  email: '',
  role: 'user',
  expiresIn: '365d'
})

const isLoading = ref(false)

async function handleSetToken() {
  if (!tokenInput.value.trim()) {
    toast.error('Token não pode estar vazio')
    return
  }

  isLoading.value = true
  try {
    await authStore.setToken(tokenInput.value.trim())
    toast.success('Token configurado com sucesso')
    emit('close')
  } catch {
    toast.error('Token inválido')
  } finally {
    isLoading.value = false
  }
}

async function handleGenerate() {
  if (!generateForm.value.userId || !generateForm.value.email) {
    toast.error('Preencha todos os campos obrigatórios')
    return
  }

  isLoading.value = true
  try {
    const result = await authStore.generateToken(generateForm.value)
    tokenInput.value = result.token
    mode.value = 'set'
    toast.success('Token gerado com sucesso')
  } catch (error) {
    toast.error('Erro ao gerar token')
  } finally {
    isLoading.value = false
  }
}

async function copyToken() {
  if (!tokenInput.value) return

  await navigator.clipboard.writeText(tokenInput.value)
  copied.value = true
  toast.success('Token copiado!')

  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function clearToken() {
  authStore.setToken(null)
  tokenInput.value = ''
  toast.info('Token removido')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Configurar Token JWT</h2>
        <button
          @click="emit('close')"
          class="p-2 rounded-lg hover:bg-gray-100"
        >
          <X class="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-4">
        <!-- Mode tabs -->
        <div class="flex gap-2 mb-4">
          <button
            @click="mode = 'set'"
            class="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
            :class="[
              mode === 'set'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            Usar Token Existente
          </button>
          <button
            @click="mode = 'generate'"
            class="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
            :class="[
              mode === 'generate'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            Gerar Novo Token
          </button>
        </div>

        <!-- Set token form -->
        <form v-if="mode === 'set'" @submit.prevent="handleSetToken" class="space-y-4">
          <div>
            <label class="label">Token JWT</label>
            <div class="relative">
              <textarea
                v-model="tokenInput"
                class="input pr-10 font-mono text-xs"
                rows="3"
                placeholder="Cole seu token JWT aqui..."
              />
              <button
                v-if="tokenInput"
                type="button"
                @click="copyToken"
                class="absolute top-2 right-2 p-1.5 rounded hover:bg-gray-100"
              >
                <component :is="copied ? Check : Copy" class="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="isLoading"
              class="btn-primary flex-1"
            >
              {{ isLoading ? 'Validando...' : 'Salvar Token' }}
            </button>
            <button
              v-if="authStore.token"
              type="button"
              @click="clearToken"
              class="btn-danger"
            >
              Limpar
            </button>
          </div>
        </form>

        <!-- Generate token form -->
        <form v-else @submit.prevent="handleGenerate" class="space-y-4">
          <div>
            <label class="label">User ID *</label>
            <input
              v-model="generateForm.userId"
              type="text"
              class="input"
              placeholder="user_123"
              required
            />
          </div>

          <div>
            <label class="label">Email *</label>
            <input
              v-model="generateForm.email"
              type="email"
              class="input"
              placeholder="usuario@email.com"
              required
            />
          </div>

          <div>
            <label class="label">Role</label>
            <select v-model="generateForm.role" class="select">
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
              <option value="operator">Operador</option>
            </select>
          </div>

          <div>
            <label class="label">Expira em</label>
            <select v-model="generateForm.expiresIn" class="select">
              <option value="1d">1 dia</option>
              <option value="7d">7 dias</option>
              <option value="30d">30 dias</option>
              <option value="365d">1 ano</option>
            </select>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary w-full"
          >
            {{ isLoading ? 'Gerando...' : 'Gerar Token' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
