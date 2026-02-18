<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import type { PipelineStage } from '@/types'

defineProps<{
  stages: PipelineStage[]
  selectedCount: number
}>()

const emit = defineEmits<{
  move: [stageId: string | null]
  close: []
}>()
</script>

<template>
  <div class="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-30 overflow-hidden">
    <div class="p-3 border-b border-gray-100">
      <p class="text-sm font-medium text-gray-900">
        Mover {{ selectedCount }} conversa{{ selectedCount > 1 ? 's' : '' }} para:
      </p>
    </div>
    <div class="max-h-64 overflow-y-auto py-1">
      <!-- Sem etapa -->
      <button
        class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
        @click="emit('move', null)"
      >
        <div class="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0 border border-dashed border-gray-500"></div>
        <span class="text-sm text-gray-700 flex-1">Sem etapa</span>
        <ArrowRight class="w-3.5 h-3.5 text-gray-400" />
      </button>
      <!-- Stages -->
      <button
        v-for="stage in stages"
        :key="stage._id"
        class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
        @click="emit('move', stage._id)"
      >
        <div
          class="w-3 h-3 rounded-full flex-shrink-0"
          :style="{ backgroundColor: stage.color }"
        ></div>
        <span class="text-sm text-gray-700 flex-1 truncate">{{ stage.name }}</span>
        <ArrowRight class="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
    <div class="p-2 border-t border-gray-100">
      <button
        @click="emit('close')"
        class="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
      >
        Cancelar
      </button>
    </div>
  </div>
</template>
