<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { pipelineStagesApi } from '@/api'
import { Plus, Edit3, Trash2, GripVertical, X, AlertTriangle } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import type { PipelineStage, PipelineStagePayload } from '@/types'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: []
}>()

const toast = useToast()

const stages = ref<PipelineStage[]>([])
const isLoading = ref(false)
const editingId = ref<string | null>(null)
const editForm = ref({ name: '', color: '#3b82f6' })
const newStage = ref({ name: '', color: '#3b82f6' })

// Drag state
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// Delete confirmation
const showDeleteConfirm = ref(false)
const stageToDelete = ref<PipelineStage | null>(null)

const presetColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

function close() {
  emit('update:modelValue', false)
}

async function loadStages() {
  isLoading.value = true
  try {
    const response = await pipelineStagesApi.list()
    if (response.data) {
      stages.value = response.data
    }
  } catch {
    toast.error('Erro ao carregar etapas')
  } finally {
    isLoading.value = false
  }
}

async function handleCreate() {
  if (!newStage.value.name.trim()) {
    toast.error('Informe o nome da etapa')
    return
  }

  try {
    const payload: PipelineStagePayload = {
      name: newStage.value.name.trim(),
      color: newStage.value.color,
      order: stages.value.length
    }
    await pipelineStagesApi.create(payload)
    toast.success('Etapa criada com sucesso')
    newStage.value = { name: '', color: '#3b82f6' }
    await loadStages()
    emit('updated')
  } catch {
    toast.error('Erro ao criar etapa')
  }
}

function startEdit(stage: PipelineStage) {
  editingId.value = stage._id
  editForm.value = { name: stage.name, color: stage.color }
}

function cancelEdit() {
  editingId.value = null
  editForm.value = { name: '', color: '#3b82f6' }
}

async function handleUpdate(id: string) {
  if (!editForm.value.name.trim()) {
    toast.error('Informe o nome da etapa')
    return
  }

  try {
    await pipelineStagesApi.update(id, {
      name: editForm.value.name.trim(),
      color: editForm.value.color
    })
    toast.success('Etapa atualizada com sucesso')
    editingId.value = null
    editForm.value = { name: '', color: '#3b82f6' }
    await loadStages()
    emit('updated')
  } catch {
    toast.error('Erro ao atualizar etapa')
  }
}

function requestDelete(stage: PipelineStage) {
  stageToDelete.value = stage
  showDeleteConfirm.value = true
}

function cancelDelete() {
  stageToDelete.value = null
  showDeleteConfirm.value = false
}

async function confirmDelete() {
  if (!stageToDelete.value) return

  try {
    await pipelineStagesApi.delete(stageToDelete.value._id)
    toast.success('Etapa excluida com sucesso')
    await loadStages()
    emit('updated')
  } catch {
    toast.error('Erro ao excluir etapa')
  } finally {
    stageToDelete.value = null
    showDeleteConfirm.value = false
  }
}

function selectPresetColor(color: string, target: 'new' | 'edit') {
  if (target === 'new') {
    newStage.value.color = color
  } else {
    editForm.value.color = color
  }
}

// Drag and Drop handlers
function onDragStart(index: number) {
  dragIndex.value = index
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

async function onDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) {
    dragIndex.value = null
    dragOverIndex.value = null
    return
  }

  const reordered = [...stages.value]
  const [moved] = reordered.splice(dragIndex.value, 1)
  reordered.splice(targetIndex, 0, moved)

  stages.value = reordered
  dragIndex.value = null
  dragOverIndex.value = null

  try {
    const reorderPayload = reordered.map((stage, idx) => ({
      id: stage._id,
      order: idx
    }))
    await pipelineStagesApi.reorder(reorderPayload)
    toast.success('Ordem atualizada')
    emit('updated')
  } catch {
    toast.error('Erro ao reordenar etapas')
    await loadStages()
  }
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

watch(() => props.modelValue, (val) => {
  if (val) {
    loadStages()
  }
})

onMounted(() => {
  if (props.modelValue) {
    loadStages()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      @click.self="close"
    >
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            Gerenciar Etapas
          </h2>
          <button @click="close" class="p-2 rounded-lg hover:bg-gray-100">
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Loading -->
          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>

          <!-- Stages list -->
          <div v-else class="space-y-2">
            <p v-if="stages.length === 0" class="text-sm text-gray-500 text-center py-4">
              Nenhuma etapa cadastrada
            </p>

            <div
              v-for="(stage, index) in stages"
              :key="stage._id"
              draggable="true"
              class="flex items-center gap-3 p-3 rounded-lg border transition-colors"
              :class="{
                'border-primary-300 bg-primary-50': dragOverIndex === index,
                'border-gray-200 bg-white': dragOverIndex !== index,
                'opacity-50': dragIndex === index
              }"
              @dragstart="onDragStart(index)"
              @dragover="onDragOver($event, index)"
              @dragleave="onDragLeave"
              @drop="onDrop(index)"
              @dragend="onDragEnd"
            >
              <!-- Drag handle -->
              <GripVertical class="w-5 h-5 text-gray-400 cursor-grab flex-shrink-0" />

              <!-- View mode -->
              <template v-if="editingId !== stage._id">
                <div
                  class="w-5 h-5 rounded-full flex-shrink-0 border border-gray-200"
                  :style="{ backgroundColor: stage.color }"
                ></div>
                <span class="flex-1 text-sm font-medium text-gray-900 truncate">
                  {{ stage.name }}
                </span>
                <button
                  @click="startEdit(stage)"
                  class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="Editar"
                >
                  <Edit3 class="w-4 h-4" />
                </button>
                <button
                  @click="requestDelete(stage)"
                  class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                  title="Excluir"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </template>

              <!-- Edit mode -->
              <template v-else>
                <div class="flex-1 space-y-2">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="editForm.name"
                      type="text"
                      class="input flex-1 text-sm"
                      placeholder="Nome da etapa"
                      @keyup.enter="handleUpdate(stage._id)"
                      @keyup.escape="cancelEdit"
                    />
                  </div>
                  <!-- Color swatches -->
                  <div class="flex items-center gap-1.5">
                    <button
                      v-for="color in presetColors"
                      :key="color"
                      class="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                      :class="editForm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
                      :style="{ backgroundColor: color }"
                      @click="selectPresetColor(color, 'edit')"
                    />
                    <input
                      type="color"
                      v-model="editForm.color"
                      class="w-5 h-5 rounded cursor-pointer border border-gray-200 flex-shrink-0"
                      title="Cor personalizada"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="handleUpdate(stage._id)"
                      class="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                    >
                      Salvar
                    </button>
                    <button
                      @click="cancelEdit"
                      class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Add new stage -->
          <div class="pt-4 border-t border-gray-200">
            <p class="text-sm font-medium text-gray-700 mb-2">Adicionar nova etapa</p>
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <input
                  v-model="newStage.name"
                  type="text"
                  class="input flex-1 text-sm"
                  placeholder="Nome da etapa"
                  @keyup.enter="handleCreate"
                />
                <button
                  @click="handleCreate"
                  class="btn-primary flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Plus class="w-4 h-4" />
                  Adicionar
                </button>
              </div>
              <!-- Color swatches for new stage -->
              <div class="flex items-center gap-1.5">
                <button
                  v-for="color in presetColors"
                  :key="color"
                  class="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  :class="newStage.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
                  :style="{ backgroundColor: color }"
                  @click="selectPresetColor(color, 'new')"
                />
                <input
                  type="color"
                  v-model="newStage.color"
                  class="w-5 h-5 rounded cursor-pointer border border-gray-200 flex-shrink-0"
                  title="Cor personalizada"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      @click.self="cancelDelete"
    >
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle class="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900">Excluir etapa</h3>
            <p class="text-sm text-gray-500">
              {{ stageToDelete?.name }}
            </p>
          </div>
        </div>
        <p class="text-sm text-gray-600 mb-4">
          As conversas nesta etapa serao movidas para <strong>"Sem etapa"</strong>. Esta acao nao pode ser desfeita.
        </p>
        <div class="flex items-center justify-end gap-2">
          <button @click="cancelDelete" class="btn-secondary text-sm">
            Cancelar
          </button>
          <button @click="confirmDelete" class="btn-danger text-sm">
            Excluir
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
