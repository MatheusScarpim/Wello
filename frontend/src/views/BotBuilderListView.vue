<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { visualBotsApi } from '@/api'
import type { VisualBotDefinition } from '@/types/botBuilder'
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Upload,
  CloudOff,
  Bot,
  Loader2,
  Search,
} from 'lucide-vue-next'

const router = useRouter()
const toast = useToast()

const bots = ref<VisualBotDefinition[]>([])
const isLoading = ref(true)
const search = ref('')
const showCreateModal = ref(false)
const newBotName = ref('')
const newBotId = ref('')
const newBotDescription = ref('')
const isCreating = ref(false)

onMounted(loadBots)

async function loadBots() {
  isLoading.value = true
  try {
    const response = await visualBotsApi.list(search.value || undefined)
    bots.value = response.data || []
  } catch (error: any) {
    toast.error('Erro ao carregar bots')
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  newBotName.value = ''
  newBotId.value = ''
  newBotDescription.value = ''
  showCreateModal.value = true
}

function generateBotId() {
  newBotId.value = newBotName.value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

async function createBot() {
  if (!newBotName.value.trim() || !newBotId.value.trim()) return

  isCreating.value = true
  try {
    const response = await visualBotsApi.create({
      name: newBotName.value.trim(),
      botId: newBotId.value.trim(),
      description: newBotDescription.value.trim() || undefined,
    })

    const created = response.data
    showCreateModal.value = false
    toast.success('Bot criado com sucesso!')

    router.push(`/bot-builder/${created._id}`)
  } catch (error: any) {
    toast.error(error?.response?.data?.error || 'Erro ao criar bot')
  } finally {
    isCreating.value = false
  }
}

function editBot(bot: VisualBotDefinition) {
  router.push(`/bot-builder/${bot._id}`)
}

async function duplicateBot(bot: VisualBotDefinition) {
  try {
    await visualBotsApi.duplicate(bot._id!)
    toast.success('Bot duplicado com sucesso!')
    await loadBots()
  } catch (error: any) {
    toast.error(error?.response?.data?.error || 'Erro ao duplicar bot')
  }
}

async function deleteBot(bot: VisualBotDefinition) {
  if (!confirm(`Tem certeza que deseja excluir o bot "${bot.name}"?`)) return

  try {
    await visualBotsApi.delete(bot._id!)
    toast.success('Bot removido com sucesso!')
    await loadBots()
  } catch (error: any) {
    toast.error(error?.response?.data?.error || 'Erro ao remover bot')
  }
}

async function togglePublish(bot: VisualBotDefinition) {
  try {
    if (bot.status === 'published') {
      await visualBotsApi.unpublish(bot._id!)
      toast.success('Bot despublicado!')
    } else {
      await visualBotsApi.publish(bot._id!)
      toast.success('Bot publicado!')
    }
    await loadBots()
  } catch (error: any) {
    toast.error(error?.response?.data?.error || 'Erro ao alterar status')
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Bot Builder</h1>
        <p class="text-sm text-gray-500 mt-1">
          Crie e gerencie fluxos de conversação visuais
        </p>
      </div>
      <button
        @click="openCreateModal"
        class="btn-primary flex items-center gap-2"
      >
        <Plus class="w-4 h-4" />
        Novo Bot
      </button>
    </div>

    <!-- Search -->
    <div class="relative mb-4">
      <Search class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        v-model="search"
        @input="loadBots"
        type="text"
        placeholder="Buscar bots..."
        class="input pl-10 w-full"
      />
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 text-primary-600 animate-spin" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="bots.length === 0"
      class="flex flex-col items-center justify-center py-20"
    >
      <Bot class="w-12 h-12 text-gray-300 mb-3" />
      <h3 class="text-lg font-medium text-gray-600">Nenhum bot criado</h3>
      <p class="text-sm text-gray-400 mt-1">
        Crie seu primeiro bot visual clicando no botão acima
      </p>
    </div>

    <!-- Bot list -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="bot in bots"
        :key="bot._id"
        class="card hover:shadow-md transition-shadow cursor-pointer"
        @click="editBot(bot)"
      >
        <div class="card-body">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 truncate">{{ bot.name }}</h3>
              <p class="text-xs text-gray-400 font-mono">{{ bot.botId }}</p>
            </div>
            <span
              class="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ml-2"
              :class="bot.status === 'published'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'"
            >
              {{ bot.status === 'published' ? 'Publicado' : 'Rascunho' }}
            </span>
          </div>

          <p v-if="bot.description" class="text-sm text-gray-500 mb-3 line-clamp-2">
            {{ bot.description }}
          </p>

          <div class="flex items-center gap-4 text-xs text-gray-400 mb-3">
            <span>{{ bot.nodes?.length || 0 }} nós</span>
            <span>{{ bot.edges?.length || 0 }} conexões</span>
          </div>

          <div class="text-xs text-gray-400">
            Atualizado em {{ formatDate(bot.updatedAt) }}
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100" @click.stop>
            <button
              @click="editBot(bot)"
              class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Editar"
            >
              <Pencil class="w-4 h-4 text-gray-400" />
            </button>
            <button
              @click="duplicateBot(bot)"
              class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Duplicar"
            >
              <Copy class="w-4 h-4 text-gray-400" />
            </button>
            <button
              @click="togglePublish(bot)"
              class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              :title="bot.status === 'published' ? 'Despublicar' : 'Publicar'"
            >
              <CloudOff v-if="bot.status === 'published'" class="w-4 h-4 text-gray-400" />
              <Upload v-else class="w-4 h-4 text-gray-400" />
            </button>
            <button
              @click="deleteBot(bot)"
              class="p-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto"
              title="Excluir"
            >
              <Trash2 class="w-4 h-4 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-[60] flex items-center justify-center"
      >
        <div
          class="absolute inset-0 bg-black/50"
          @click="showCreateModal = false"
        />
        <div class="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
          <h2 class="text-lg font-bold text-gray-900 mb-4">Criar Novo Bot</h2>

          <div class="space-y-4">
            <div>
              <label class="label">Nome do Bot</label>
              <input
                v-model="newBotName"
                @input="generateBotId"
                type="text"
                class="input w-full"
                placeholder="Ex: Bot de Atendimento"
              />
            </div>

            <div>
              <label class="label">ID do Bot</label>
              <input
                v-model="newBotId"
                type="text"
                class="input w-full font-mono text-sm"
                placeholder="ex: bot-atendimento"
              />
              <p class="text-xs text-gray-400 mt-1">
                Identificador único. Será gerado automaticamente.
              </p>
            </div>

            <div>
              <label class="label">Descrição (opcional)</label>
              <textarea
                v-model="newBotDescription"
                class="input w-full"
                rows="2"
                placeholder="Descreva o propósito deste bot..."
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <button
              @click="showCreateModal = false"
              class="btn-ghost"
            >
              Cancelar
            </button>
            <button
              @click="createBot"
              :disabled="!newBotName.trim() || !newBotId.trim() || isCreating"
              class="btn-primary flex items-center gap-2"
            >
              <Loader2 v-if="isCreating" class="w-4 h-4 animate-spin" />
              Criar Bot
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
