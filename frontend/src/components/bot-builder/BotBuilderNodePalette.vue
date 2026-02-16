<script setup lang="ts">
import { NODE_TYPES } from '@/types/botBuilder'
import type { VisualNodeType } from '@/types/botBuilder'
import {
  Play,
  MessageSquare,
  HelpCircle,
  MousePointerClick,
  List,
  GitBranch,
  Code,
  Globe,
  Clock,
  Sparkles,
  Square,
} from 'lucide-vue-next'

const iconMap: Record<string, any> = {
  play: Play,
  'message-square': MessageSquare,
  'help-circle': HelpCircle,
  'mouse-pointer-click': MousePointerClick,
  list: List,
  'git-branch': GitBranch,
  variable: Code,
  globe: Globe,
  clock: Clock,
  sparkles: Sparkles,
  square: Square,
}

function onDragStart(event: DragEvent, nodeType: VisualNodeType) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/vueflow', nodeType)
  event.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <div class="w-60 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-200">
      <h3 class="font-semibold text-sm text-gray-700">Nós</h3>
      <p class="text-xs text-gray-400 mt-0.5">Arraste para o canvas</p>
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
      <div
        v-for="nodeType in NODE_TYPES"
        :key="nodeType.type"
        :draggable="true"
        @dragstart="(e) => onDragStart(e, nodeType.type)"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <div
          class="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          :style="{ backgroundColor: nodeType.bgColor, border: `1px solid ${nodeType.borderColor}` }"
        >
          <component
            :is="iconMap[nodeType.icon]"
            class="w-3.5 h-3.5"
            :style="{ color: nodeType.color }"
          />
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-700 truncate">{{ nodeType.label }}</p>
          <p class="text-[10px] text-gray-400 truncate">{{ nodeType.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
