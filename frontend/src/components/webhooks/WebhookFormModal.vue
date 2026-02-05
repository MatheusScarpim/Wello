<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { webhooksApi } from '@/api'
import { X, Plus, Trash2 } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import type { Webhook } from '@/types'

const props = defineProps<{
  webhook: Webhook | null
  availableEvents: string[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const isLoading = ref(false)

const form = ref({
  name: '',
  url: '',
  events: [] as string[],
  enabled: true,
  secret: '',
  headers: [] as { key: string; value: string }[],
  retryAttempts: 3,
  retryDelay: 1000
})

const isEditing = computed(() => !!props.webhook)

onMounted(() => {
  if (props.webhook) {
    form.value = {
      name: props.webhook.name,
      url: props.webhook.url,
      events: [...props.webhook.events],
      enabled: props.webhook.enabled,
      secret: props.webhook.secret || '',
      headers: props.webhook.headers
        ? Object.entries(props.webhook.headers).map(([key, value]) => ({ key, value }))
        : [],
      retryAttempts: props.webhook.retryAttempts || 3,
      retryDelay: props.webhook.retryDelay || 1000
    }
  }
})

function addHeader() {
  form.value.headers.push({ key: '', value: '' })
}

function removeHeader(index: number) {
  form.value.headers.splice(index, 1)
}

async function handleSubmit() {
  if (!form.value.name || !form.value.url || form.value.events.length === 0) {
    toast.error('Preencha todos os campos obrigatórios')
    return
  }

  isLoading.value = true
  try {
    const headersObj = form.value.headers.reduce((acc, { key, value }) => {
      if (key && value) acc[key] = value
      return acc
    }, {} as Record<string, string>)

    const payload = {
      name: form.value.name,
      url: form.value.url,
      events: form.value.events,
      enabled: form.value.enabled,
      secret: form.value.secret || undefined,
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      retryAttempts: form.value.retryAttempts,
      retryDelay: form.value.retryDelay
    }

    if (isEditing.value && props.webhook) {
      await webhooksApi.update(props.webhook._id, payload)
      toast.success('Webhook atualizado')
    } else {
      await webhooksApi.create(payload)
      toast.success('Webhook criado')
    }

    emit('saved')
    emit('close')
  } catch {
    toast.error('Erro ao salvar webhook')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            {{ isEditing ? 'Editar Webhook' : 'Novo Webhook' }}
          </h2>
          <button @click="emit('close')" class="p-2 rounded-lg hover:bg-gray-100">
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label class="label">Nome *</label>
            <input
              v-model="form.name"
              type="text"
              class="input"
              placeholder="Meu Webhook"
              required
            />
          </div>

          <div>
            <label class="label">URL *</label>
            <input
              v-model="form.url"
              type="url"
              class="input"
              placeholder="https://exemplo.com/webhook"
              required
            />
          </div>

          <div>
            <label class="label">Eventos *</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="event in availableEvents"
                :key="event"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors"
                :class="form.events.includes(event) ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'"
              >
                <input
                  type="checkbox"
                  :value="event"
                  v-model="form.events"
                  class="sr-only"
                />
                <span class="text-sm" :class="form.events.includes(event) ? 'text-primary-700' : 'text-gray-700'">
                  {{ event }}
                </span>
              </label>
            </div>
          </div>

          <div>
            <label class="label">Secret (opcional)</label>
            <input
              v-model="form.secret"
              type="text"
              class="input font-mono"
              placeholder="secret-key"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="label mb-0">Headers (opcional)</label>
              <button type="button" @click="addHeader" class="btn-ghost btn-sm">
                <Plus class="w-4 h-4" />
                Adicionar
              </button>
            </div>
            <div v-for="(header, index) in form.headers" :key="index" class="flex gap-2 mb-2">
              <input
                v-model="header.key"
                type="text"
                class="input flex-1"
                placeholder="Header"
              />
              <input
                v-model="header.value"
                type="text"
                class="input flex-1"
                placeholder="Valor"
              />
              <button type="button" @click="removeHeader(index)" class="btn-ghost btn-sm text-red-600">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Tentativas</label>
              <input
                v-model.number="form.retryAttempts"
                type="number"
                min="0"
                max="10"
                class="input"
              />
            </div>
            <div>
              <label class="label">Delay (ms)</label>
              <input
                v-model.number="form.retryDelay"
                type="number"
                min="100"
                max="60000"
                class="input"
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              v-model="form.enabled"
              class="w-4 h-4 text-primary-600 rounded"
            />
            <label for="enabled" class="text-sm text-gray-700">Webhook ativo</label>
          </div>
        </form>

        <!-- Footer -->
        <div class="flex gap-3 p-4 border-t border-gray-200">
          <button type="button" @click="emit('close')" class="btn-secondary flex-1">
            Cancelar
          </button>
          <button @click="handleSubmit" :disabled="isLoading" class="btn-primary flex-1">
            {{ isLoading ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
