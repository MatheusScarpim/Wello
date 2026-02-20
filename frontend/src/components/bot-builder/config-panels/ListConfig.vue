<script setup lang="ts">
import { computed } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-vue-next'

interface ListRow {
  id: string
  title: string
  description: string
}

interface ListSection {
  title: string
  rows: ListRow[]
}

const store = useBotBuilderStore()

const nodeData = computed(() => store.selectedNode?.data || {})

const sections = computed<ListSection[]>(() =>
  nodeData.value.sections || [{ title: '', rows: [{ id: generateId(), title: '', description: '' }] }]
)

function generateId(): string {
  return 'row_' + Math.random().toString(36).substring(2, 9)
}

function updateField(field: string, value: any) {
  if (!store.selectedNodeId) return
  store.updateNodeData(store.selectedNodeId, { [field]: value })
}

function updateSectionTitle(sectionIndex: number, title: string) {
  const updated = sections.value.map((s, i) =>
    i === sectionIndex ? { ...s, title } : s
  )
  updateField('sections', updated)
}

function updateRow(sectionIndex: number, rowIndex: number, field: string, value: string) {
  const updated = sections.value.map((s, si) => {
    if (si !== sectionIndex) return s
    const rows = s.rows.map((r, ri) =>
      ri === rowIndex ? { ...r, [field]: value } : r
    )
    return { ...s, rows }
  })
  updateField('sections', updated)
}

function addSection() {
  const updated = [
    ...sections.value,
    { title: '', rows: [{ id: generateId(), title: '', description: '' }] }
  ]
  updateField('sections', updated)
}

function removeSection(sectionIndex: number) {
  if (sections.value.length <= 1) return
  const updated = sections.value.filter((_, i) => i !== sectionIndex)
  updateField('sections', updated)
}

function addRow(sectionIndex: number) {
  const updated = sections.value.map((s, i) => {
    if (i !== sectionIndex) return s
    return {
      ...s,
      rows: [...s.rows, { id: generateId(), title: '', description: '' }]
    }
  })
  updateField('sections', updated)
}

function removeRow(sectionIndex: number, rowIndex: number) {
  const section = sections.value[sectionIndex]
  if (section.rows.length <= 1) return
  const updated = sections.value.map((s, si) => {
    if (si !== sectionIndex) return s
    return {
      ...s,
      rows: s.rows.filter((_, ri) => ri !== rowIndex)
    }
  })
  updateField('sections', updated)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div class="border-b border-gray-200 pb-3">
      <h3 class="text-lg font-semibold text-gray-900">Lista</h3>
      <p class="text-sm text-gray-500">Envia uma mensagem com lista de opções</p>
    </div>

    <!-- Label -->
    <div>
      <label class="label">Label</label>
      <input
        type="text"
        class="input"
        placeholder="Lista"
        :value="nodeData.label"
        @input="updateField('label', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Titulo -->
    <div>
      <label class="label">Título</label>
      <input
        type="text"
        class="input"
        placeholder="Título da lista"
        :value="nodeData.title"
        @input="updateField('title', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Descricao -->
    <div>
      <label class="label">Descrição</label>
      <textarea
        class="input min-h-[60px] resize-y"
        placeholder="Descrição da lista"
        :value="nodeData.description"
        @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Texto do botao -->
    <div>
      <label class="label">Texto do botão</label>
      <input
        type="text"
        class="input"
        placeholder="Ver opções"
        :value="nodeData.buttonText"
        @input="updateField('buttonText', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Nome da variavel -->
    <div>
      <label class="label">Nome da variável (opcional)</label>
      <input
        type="text"
        class="input font-mono"
        placeholder="resposta_lista"
        :value="nodeData.variableName"
        @input="updateField('variableName', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Secoes -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="label mb-0">Seções</label>
      </div>

      <div class="space-y-3">
        <div
          v-for="(section, sectionIndex) in sections"
          :key="sectionIndex"
          class="border border-gray-200 rounded-lg p-3"
        >
          <!-- Section header -->
          <div class="flex items-center gap-2 mb-3">
            <input
              type="text"
              class="input flex-1"
              placeholder="Título da seção"
              :value="section.title"
              @input="updateSectionTitle(sectionIndex, ($event.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
              :disabled="sections.length <= 1"
              :class="{ 'opacity-30 cursor-not-allowed': sections.length <= 1 }"
              @click="removeSection(sectionIndex)"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Rows -->
          <div class="space-y-2 ml-2">
            <div
              v-for="(row, rowIndex) in section.rows"
              :key="row.id"
              class="flex items-start gap-2 bg-gray-50 rounded-lg p-2"
            >
              <div class="flex-1 space-y-1">
                <input
                  type="text"
                  class="input text-sm"
                  placeholder="Título da linha"
                  :value="row.title"
                  @input="updateRow(sectionIndex, rowIndex, 'title', ($event.target as HTMLInputElement).value)"
                />
                <input
                  type="text"
                  class="input text-sm"
                  placeholder="Descrição da linha"
                  :value="row.description"
                  @input="updateRow(sectionIndex, rowIndex, 'description', ($event.target as HTMLInputElement).value)"
                />
              </div>
              <button
                type="button"
                class="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0 mt-1"
                :disabled="section.rows.length <= 1"
                :class="{ 'opacity-30 cursor-not-allowed': section.rows.length <= 1 }"
                @click="removeRow(sectionIndex, rowIndex)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              class="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors"
              @click="addRow(sectionIndex)"
            >
              <Plus class="w-3.5 h-3.5" />
              Adicionar linha
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="mt-2 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
        @click="addSection"
      >
        <Plus class="w-4 h-4" />
        Adicionar seção
      </button>
    </div>
  </div>
</template>
