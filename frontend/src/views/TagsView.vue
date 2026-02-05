<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { RefreshCw, Edit3, Trash2, Plus, Tag, Tags } from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { tagsApi } from '@/api'
import type { Tag as TagType, TagPayload } from '@/types'
import ExcelActions from '@/components/ui/ExcelActions.vue'

const toast = useToast()
const tags = ref<TagType[]>([])
const isLoading = ref(true)
const isSaving = ref(false)
const showEditModal = ref(false)
const editTarget = ref<TagType | null>(null)
const editForm = ref<TagPayload>({ name: '', color: '#3B82F6' })
const isEditing = ref(false)
const newTag = ref<TagPayload>({ name: '', color: '#3B82F6', description: '' })

const presetColors = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'
]

async function fetchTags() {
  isLoading.value = true
  try {
    const response = await tagsApi.list()
    if (response.data) {
      tags.value = response.data
    }
  } catch {
    toast.error('Erro ao carregar tags')
  } finally {
    isLoading.value = false
  }
}

async function createTag() {
  const payload = {
    name: newTag.value.name.trim(),
    color: newTag.value.color,
    description: newTag.value.description?.trim() || undefined,
  }

  if (!payload.name) {
    toast.error('Informe o nome da tag')
    return
  }

  isSaving.value = true
  try {
    await tagsApi.create(payload)
    toast.success('Tag criada com sucesso')
    newTag.value = { name: '', color: '#3B82F6', description: '' }
    fetchTags()
  } catch {
    toast.error('Erro ao criar tag')
  } finally {
    isSaving.value = false
  }
}

function openEditModal(tag: TagType) {
  editTarget.value = tag
  editForm.value = { name: tag.name, color: tag.color, description: tag.description || '' }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editTarget.value = null
}

async function saveEdit() {
  if (!editTarget.value) return

  const payload = {
    name: editForm.value.name.trim(),
    color: editForm.value.color,
    description: editForm.value.description?.trim() || undefined,
  }

  if (!payload.name) {
    toast.error('Informe o nome da tag')
    return
  }

  isEditing.value = true
  try {
    await tagsApi.update(editTarget.value._id, payload)
    toast.success('Tag atualizada')
    closeEditModal()
    fetchTags()
  } catch {
    toast.error('Erro ao atualizar tag')
  } finally {
    isEditing.value = false
  }
}

async function deleteTag(id: string) {
  if (!window.confirm('Tem certeza que deseja remover esta tag?')) {
    return
  }

  try {
    await tagsApi.delete(id)
    toast.success('Tag removida')
    fetchTags()
  } catch {
    toast.error('Erro ao remover tag')
  }
}

// Excel handlers
const exportData = computed(() => {
  return tags.value.map(tag => ({
    Nome: tag.name,
    Cor: tag.color,
    Descrição: tag.description || '',
    'Criado em': tag.createdAt ? new Date(tag.createdAt).toLocaleString('pt-BR') : '',
  }))
})

async function handleImport(data: any[]) {
  const validTags = data.filter(row => row.Nome || row.name)

  if (validTags.length === 0) {
    toast.error('Nenhuma tag válida encontrada no arquivo')
    return
  }

  let created = 0
  let failed = 0

  for (const row of validTags) {
    try {
      const name = row.Nome || row.name
      const color = row.Cor || row.color || '#3B82F6'
      const description = row.Descrição || row.description || ''

      await tagsApi.create({
        name,
        color,
        description
      })
      created++
    } catch (error) {
      console.error('Erro ao criar tag:', error)
      failed++
    }
  }

  if (created > 0) {
    toast.success(`${created} tag(s) importada(s) com sucesso!`)
    fetchTags()
  }

  if (failed > 0) {
    toast.warning(`${failed} tag(s) falharam ao importar (podem já existir)`)
  }
}

onMounted(() => {
  fetchTags()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Tags</h1>
        <p class="text-gray-500">Gerencie as tags para categorizar atendimentos.</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <ExcelActions
          :data="exportData"
          :export-options="{
            filename: 'tags.xlsx',
            sheetName: 'Tags'
          }"
          :on-import="handleImport"
        />
        <button @click="fetchTags" class="btn-outline">
          <RefreshCw class="w-4 h-4" />
          Atualizar
        </button>
      </div>
    </div>

    <!-- Stats Card -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 w-fit">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
          <Tags class="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <p class="text-2xl font-bold text-gray-900">{{ tags.length }}</p>
          <p class="text-xs text-gray-500">Tags cadastradas</p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Form Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-5 h-fit">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <Plus class="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h2 class="font-semibold text-gray-900">Nova Tag</h2>
            <p class="text-xs text-gray-500">Adicione uma tag para categorizar</p>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="label">Nome</label>
            <input
              v-model="newTag.name"
              type="text"
              class="input"
              placeholder="Ex: Urgente, VIP, Suporte..."
            />
          </div>

          <div>
            <label class="label">Cor</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in presetColors"
                :key="color"
                type="button"
                @click="newTag.color = color"
                class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                :class="newTag.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
                :style="{ backgroundColor: color }"
              />
            </div>
          </div>

          <div>
            <label class="label">Descricao (opcional)</label>
            <textarea
              v-model="newTag.description"
              class="input"
              rows="2"
              placeholder="Descricao da tag..."
            />
          </div>

          <button
            @click="createTag"
            class="btn-primary w-full justify-center"
            :disabled="isSaving || !newTag.name.trim()"
          >
            <Plus v-if="!isSaving" class="w-4 h-4" />
            <LoadingSpinner v-else size="sm" />
            <span>{{ isSaving ? 'Salvando...' : 'Criar Tag' }}</span>
          </button>
        </div>
      </div>

      <!-- List -->
      <div class="lg:col-span-2">
        <div v-if="isLoading" class="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>

        <div v-else-if="tags.length === 0" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Tags class="w-8 h-8 text-gray-400" />
          </div>
          <h3 class="font-semibold text-gray-900 mb-1">Nenhuma tag cadastrada</h3>
          <p class="text-sm text-gray-500">Crie sua primeira tag usando o formulario ao lado.</p>
        </div>

        <div v-else class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="tag in tags"
            :key="tag._id"
            class="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-gray-300 transition-colors group"
          >
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              :style="{ backgroundColor: tag.color + '20' }"
            >
              <Tag class="w-5 h-5" :style="{ color: tag.color }" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-medium text-gray-900 truncate">{{ tag.name }}</p>
                <div
                  class="w-3 h-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: tag.color }"
                />
              </div>
              <p v-if="tag.description" class="text-xs text-gray-400 truncate">{{ tag.description }}</p>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="openEditModal(tag)"
                class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                title="Editar"
              >
                <Edit3 class="w-4 h-4" />
              </button>
              <button
                @click="deleteTag(tag._id)"
                class="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                title="Remover"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        @click.self="closeEditModal"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Edit3 class="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 class="font-semibold text-gray-900">Editar Tag</h2>
              <p class="text-xs text-gray-500">Atualize os dados da tag</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label">Nome</label>
              <input v-model="editForm.name" type="text" class="input" />
            </div>

            <div>
              <label class="label">Cor</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="color in presetColors"
                  :key="color"
                  type="button"
                  @click="editForm.color = color"
                  class="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                  :class="editForm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
                  :style="{ backgroundColor: color }"
                />
              </div>
            </div>

            <div>
              <label class="label">Descricao (opcional)</label>
              <textarea
                v-model="editForm.description"
                class="input"
                rows="2"
                placeholder="Descricao da tag..."
              />
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="closeEditModal" class="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                @click="saveEdit"
                class="btn-primary flex-1 justify-center"
                :disabled="isEditing || !editForm.name.trim()"
              >
                <LoadingSpinner v-if="isEditing" size="sm" />
                <span>{{ isEditing ? 'Salvando...' : 'Salvar' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
