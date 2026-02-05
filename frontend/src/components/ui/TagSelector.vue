<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { tagsApi, queueApi } from '@/api'
import { Tag, Plus, Check, X } from 'lucide-vue-next'
import type { Tag as TagType } from '@/types'

const props = defineProps<{
  conversationId: string
  currentTags: string[]
}>()

const emit = defineEmits<{
  update: [tags: string[]]
}>()

const availableTags = ref<TagType[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
const localTags = ref<string[]>([])

// Sync local tags with props
watch(() => props.currentTags, (newTags) => {
  localTags.value = [...newTags]
}, { immediate: true })

onMounted(async () => {
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

async function toggleTag(tagName: string) {
  isLoading.value = true
  try {
    const currentSet = new Set(localTags.value)

    if (currentSet.has(tagName)) {
      currentSet.delete(tagName)
    } else {
      currentSet.add(tagName)
      // Adicionar via API
      await queueApi.addTags(props.conversationId, [tagName])
    }

    localTags.value = Array.from(currentSet)
    emit('update', localTags.value)
  } catch (error) {
    console.error('Erro ao atualizar tags:', error)
  } finally {
    isLoading.value = false
  }
}

function isTagSelected(tagName: string) {
  return localTags.value.includes(tagName)
}

function getTagColor(tagName: string) {
  const tag = availableTags.value.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}
</script>

<template>
  <div class="relative">
    <!-- Current Tags -->
    <div class="flex flex-wrap gap-1.5 mb-2" v-if="localTags.length > 0">
      <span
        v-for="tagName in localTags"
        :key="tagName"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
        :style="{ backgroundColor: getTagColor(tagName) }"
      >
        {{ tagName }}
        <button
          @click.stop="toggleTag(tagName)"
          class="hover:bg-white/20 rounded-full p-0.5"
        >
          <X class="w-3 h-3" />
        </button>
      </span>
    </div>

    <!-- Trigger -->
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <Tag class="w-3.5 h-3.5 text-gray-500" />
      <span class="text-gray-600">{{ localTags.length === 0 ? 'Adicionar tag' : 'Gerenciar tags' }}</span>
      <Plus class="w-3.5 h-3.5 text-gray-400" />
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      class="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
    >
      <div class="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
        Selecionar tags
      </div>

      <div class="max-h-48 overflow-y-auto py-1">
        <button
          v-for="tag in availableTags"
          :key="tag._id"
          @click="toggleTag(tag.name)"
          class="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
          :disabled="isLoading"
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
      </div>

      <div v-if="availableTags.length === 0" class="px-3 py-4 text-center">
        <p class="text-sm text-gray-500">Nenhuma tag cadastrada</p>
      </div>
    </div>

    <!-- Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    />
  </div>
</template>
