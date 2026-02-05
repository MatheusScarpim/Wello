<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { contactsApi, tagsApi } from '@/api'
import { X, User, Check } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import type { Contact, Tag as TagType } from '@/types'

const props = defineProps<{
  contact: Contact
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const isLoading = ref(false)
const availableTags = ref<TagType[]>([])

const form = ref({
  customName: '',
  tags: [] as string[],
})

onMounted(async () => {
  // Inicializar form com dados do contato
  form.value = {
    customName: props.contact.customName || '',
    tags: props.contact.tags ? [...props.contact.tags] : [],
  }

  // Buscar tags disponiveis
  await fetchTags()
})

async function fetchTags() {
  try {
    const response = await tagsApi.list()
    if (response.data) {
      availableTags.value = response.data
    }
  } catch (error) {
    console.error('Erro ao carregar tags:', error)
  }
}

function toggleTag(tagName: string) {
  const index = form.value.tags.indexOf(tagName)
  if (index === -1) {
    form.value.tags.push(tagName)
  } else {
    form.value.tags.splice(index, 1)
  }
}

function isTagSelected(tagName: string) {
  return form.value.tags.includes(tagName)
}

function getTagColor(tagName: string) {
  const tag = availableTags.value.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}

async function handleSubmit() {
  isLoading.value = true
  try {
    await contactsApi.update(props.contact._id, {
      customName: form.value.customName || undefined,
      tags: form.value.tags,
    })

    toast.success('Contato atualizado com sucesso')
    emit('saved')
    emit('close')
  } catch (error) {
    console.error('Erro ao atualizar contato:', error)
    toast.error('Erro ao atualizar contato')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            Editar Contato
          </h2>
          <button @click="emit('close')" class="p-2 rounded-lg hover:bg-gray-100">
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Info do Contato (somente leitura) -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                <User class="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p class="font-medium text-gray-900">{{ contact.name || contact.identifier }}</p>
                <p class="text-sm text-gray-500 font-mono">{{ contact.identifier }}</p>
              </div>
            </div>
          </div>

          <!-- Nome Personalizado -->
          <div>
            <label class="label">Nome Personalizado</label>
            <input
              v-model="form.customName"
              type="text"
              class="input"
              placeholder="Digite um nome personalizado..."
            />
            <p class="text-xs text-gray-500 mt-1">
              Este nome sera usado em novas conversas deste contato.
            </p>
          </div>

          <!-- Tags -->
          <div>
            <label class="label">Tags</label>
            <p class="text-xs text-gray-500 mb-2">
              Estas tags serao aplicadas automaticamente em novas conversas.
            </p>

            <!-- Tags Selecionadas -->
            <div v-if="form.tags.length > 0" class="flex flex-wrap gap-1.5 mb-3">
              <span
                v-for="tagName in form.tags"
                :key="tagName"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white cursor-pointer hover:opacity-80"
                :style="{ backgroundColor: getTagColor(tagName) }"
                @click="toggleTag(tagName)"
              >
                {{ tagName }}
                <X class="w-3 h-3" />
              </span>
            </div>

            <!-- Tags Disponiveis -->
            <div class="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              <button
                v-for="tag in availableTags"
                :key="tag._id"
                type="button"
                @click="toggleTag(tag.name)"
                class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div
                  class="w-3.5 h-3.5 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: tag.color }"
                />
                <span class="flex-1 text-sm text-left text-gray-700">{{ tag.name }}</span>
                <Check
                  v-if="isTagSelected(tag.name)"
                  class="w-4 h-4 text-primary-500"
                />
              </button>
              <div v-if="availableTags.length === 0" class="px-3 py-4 text-center">
                <p class="text-sm text-gray-500">Nenhuma tag cadastrada</p>
              </div>
            </div>
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
