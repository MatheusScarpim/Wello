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
  Download,
  FileUp,
  AlertTriangle,
  X,
} from 'lucide-vue-next'

const router = useRouter()
const toast = useToast()
const store = useBotBuilderStore()

const isPublishing = ref(false)

// Modal de confirmação
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
let confirmResolve: ((value: boolean) => void) | null = null

function openConfirm(title: string, message: string): Promise<boolean> {
  confirmTitle.value = title
  confirmMessage.value = message
  showConfirmModal.value = true
  return new Promise((resolve) => {
    confirmResolve = resolve
  })
}

function onConfirmYes() {
  showConfirmModal.value = false
  confirmResolve?.(true)
  confirmResolve = null
}

function onConfirmNo() {
  showConfirmModal.value = false
  confirmResolve?.(false)
  confirmResolve = null
}

async function goBack() {
  if (store.isDirty) {
    const ok = await openConfirm('Sair sem salvar?', 'Você tem alterações não salvas. Deseja sair mesmo assim?')
    if (!ok) return
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

function exportBot() {
  const data = {
    name: store.botName,
    description: store.botDescription,
    nodes: store.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      label: n.data?.label || n.label,
    })),
    edges: store.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      label: e.label,
      animated: e.animated,
    })),
    exportedAt: new Date().toISOString(),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${store.botName || 'bot'}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Bot exportado!')
}

function importBot() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        toast.error('Arquivo inválido: faltam nodes ou edges')
        return
      }

      if (store.nodes.length > 0) {
        const ok = await openConfirm('Importar bot?', 'Isso vai substituir o fluxo atual. Deseja continuar?')
        if (!ok) return
      }

      if (data.name) store.botName = data.name
      if (data.description) store.botDescription = data.description
      store.loadGeneratedBot(data.nodes, data.edges)
      toast.success('Bot importado com sucesso!')
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique se é um JSON válido.')
    }
  }
  input.click()
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
        @click="importBot"
        class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
        title="Importar bot de arquivo JSON"
      >
        <FileUp class="w-4 h-4" />
        <span>Importar</span>
      </button>

      <button
        @click="exportBot"
        class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
        title="Exportar bot como arquivo JSON"
      >
        <Download class="w-4 h-4" />
        <span>Exportar</span>
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

    <!-- Modal de confirmação -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showConfirmModal"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          @click.self="onConfirmNo"
        >
          <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div class="flex items-center gap-2">
                <AlertTriangle class="w-5 h-5 text-amber-500" />
                <h3 class="text-lg font-semibold text-gray-900">{{ confirmTitle }}</h3>
              </div>
              <button
                type="button"
                class="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                @click="onConfirmNo"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
            <div class="px-5 py-4">
              <p class="text-sm text-gray-600">{{ confirmMessage }}</p>
            </div>
            <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
              <button
                type="button"
                class="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                @click="onConfirmNo"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                @click="onConfirmYes"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
