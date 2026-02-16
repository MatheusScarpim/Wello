<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useBotBuilderStore } from '@/stores/botBuilder'
import {
  ArrowLeft,
  Save,
  Upload,
  CloudOff,
  FlaskConical,
  Loader2,
} from 'lucide-vue-next'

const router = useRouter()
const toast = useToast()
const store = useBotBuilderStore()

const isPublishing = ref(false)

function goBack() {
  if (store.isDirty) {
    if (!confirm('Você tem alterações não salvas. Deseja sair?')) return
  }
  store.reset()
  router.push('/bot-builder')
}

async function handleSave() {
  try {
    await store.save()
    toast.success('Bot salvo com sucesso!')
  } catch (error: any) {
    toast.error(error?.response?.data?.error || 'Erro ao salvar bot')
  }
}

async function handlePublish() {
  isPublishing.value = true
  try {
    if (store.botStatus === 'published') {
      await store.unpublish()
      toast.success('Bot despublicado!')
    } else {
      await store.publish()
      toast.success('Bot publicado com sucesso!')
    }
  } catch (error: any) {
    toast.error(error?.response?.data?.error || 'Erro ao publicar bot')
  } finally {
    isPublishing.value = false
  }
}

function toggleTestPanel() {
  store.showTestPanel = !store.showTestPanel
}
</script>

<template>
  <div class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
    <!-- Left: Back + Bot name -->
    <div class="flex items-center gap-3">
      <button
        @click="goBack"
        class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <ArrowLeft class="w-5 h-5 text-gray-500" />
      </button>

      <div class="flex items-center gap-2">
        <input
          v-model="store.botName"
          @input="store.markDirty()"
          class="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0 w-60"
          placeholder="Nome do bot..."
        />
        <span
          v-if="store.botStatus === 'published'"
          class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700"
        >
          Publicado
        </span>
        <span
          v-else
          class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500"
        >
          Rascunho
        </span>
        <span
          v-if="store.isDirty"
          class="w-2 h-2 rounded-full bg-orange-400"
          title="Alterações não salvas"
        />
      </div>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2">
      <button
        @click="toggleTestPanel"
        class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        :class="store.showTestPanel ? 'bg-blue-50 border-blue-200 text-blue-700' : 'text-gray-600'"
      >
        <FlaskConical class="w-4 h-4" />
        <span>Testar</span>
      </button>

      <button
        @click="handleSave"
        :disabled="store.isSaving || !store.isDirty"
        class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Loader2 v-if="store.isSaving" class="w-4 h-4 animate-spin" />
        <Save v-else class="w-4 h-4" />
        <span>Salvar</span>
      </button>

      <button
        @click="handlePublish"
        :disabled="isPublishing"
        class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        :class="store.botStatus === 'published'
          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          : 'bg-primary-600 text-white hover:bg-primary-700'"
      >
        <Loader2 v-if="isPublishing" class="w-4 h-4 animate-spin" />
        <CloudOff v-else-if="store.botStatus === 'published'" class="w-4 h-4" />
        <Upload v-else class="w-4 h-4" />
        <span>{{ store.botStatus === 'published' ? 'Despublicar' : 'Publicar' }}</span>
      </button>
    </div>
  </div>
</template>
