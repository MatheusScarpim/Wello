<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'

defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <slot name="icon">
        <Inbox class="w-8 h-8 text-gray-400" />
      </slot>
    </div>
    <h3 class="text-lg font-medium text-gray-900 mb-1">
      {{ title || 'Nenhum item encontrado' }}
    </h3>
    <p class="text-sm text-gray-500 max-w-sm">
      {{ description || 'Não há dados para exibir no momento.' }}
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
