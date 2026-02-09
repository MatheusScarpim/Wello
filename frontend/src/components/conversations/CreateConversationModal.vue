<script setup lang="ts">
import { ref } from 'vue'
import { conversationsApi } from '@/api'
import { X } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'

const emit = defineEmits<{
  close: []
  created: []
}>()

const toast = useToast()
const isLoading = ref(false)

const form = ref({
  identifier: '',
  provider: 'whatsapp',
  name: ''
})

async function handleSubmit() {
  if (!form.value.identifier) {
    toast.error('Informe o número do contato')
    return
  }

  isLoading.value = true
  try {
    await conversationsApi.create({
      identifier: form.value.identifier,
      provider: form.value.provider,
      name: form.value.name || undefined
    })
    toast.success('Conversa criada com sucesso')
    emit('created')
    emit('close')
  } catch {
    toast.error('Erro ao criar conversa')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Nova Conversa</h2>
        <button @click="emit('close')" class="p-2 rounded-lg hover:bg-gray-100">
          <X class="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
        <div>
          <label class="label">Número do Contato *</label>
          <input
            v-model="form.identifier"
            type="text"
            class="input"
            placeholder="5511999999999"
            required
          />
          <p class="text-xs text-gray-500 mt-1">
            Formato: código do país + DDD + número
          </p>
        </div>

        <div>
          <label class="label">Nome do Contato</label>
          <input
            v-model="form.name"
            type="text"
            class="input"
            placeholder="João Silva"
          />
        </div>

        <div>
          <label class="label">Provider</label>
          <select v-model="form.provider" class="select">
            <option value="whatsapp">WhatsApp</option>
            <option value="meta_whatsapp">WhatsApp Business (Meta)</option>
            <option value="instagram">Instagram Direct</option>
          </select>
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="button"
            @click="emit('close')"
            class="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary flex-1"
          >
            {{ isLoading ? 'Criando...' : 'Criar Conversa' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
