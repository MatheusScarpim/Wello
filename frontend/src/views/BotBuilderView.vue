<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { Loader2 } from 'lucide-vue-next'

import BotBuilderToolbar from '@/components/bot-builder/BotBuilderToolbar.vue'
import BotBuilderNodePalette from '@/components/bot-builder/BotBuilderNodePalette.vue'
import BotBuilderCanvas from '@/components/bot-builder/BotBuilderCanvas.vue'
import BotBuilderConfigPanel from '@/components/bot-builder/BotBuilderConfigPanel.vue'
import BotBuilderTestPanel from '@/components/bot-builder/BotBuilderTestPanel.vue'

const route = useRoute()
const store = useBotBuilderStore()

onMounted(async () => {
  const id = route.params.id as string
  if (id) {
    await store.loadDefinition(id)
  }
})

onBeforeUnmount(() => {
  store.reset()
})
</script>

<template>
  <div class="h-full flex flex-col bg-gray-100">
    <!-- Loading -->
    <div v-if="store.isLoading" class="h-full flex items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <Loader2 class="w-8 h-8 text-primary-600 animate-spin" />
        <p class="text-sm text-gray-500">Carregando bot...</p>
      </div>
    </div>

    <!-- Editor -->
    <template v-else>
      <BotBuilderToolbar />
      <div class="flex-1 flex overflow-hidden">
        <BotBuilderNodePalette />
        <BotBuilderCanvas />
        <BotBuilderConfigPanel />
        <BotBuilderTestPanel v-if="store.showTestPanel" />
      </div>
    </template>
  </div>
</template>
