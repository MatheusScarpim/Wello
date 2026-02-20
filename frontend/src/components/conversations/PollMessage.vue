<script setup lang="ts">
import { computed } from 'vue'
import { BarChart3 } from 'lucide-vue-next'

const props = defineProps<{
  message: {
    message?: string
    metadata?: {
      pollName?: string
      pollChoices?: string[]
      pollVotes?: Record<string, number>
      selectableCount?: number
    }
  }
}>()

const pollName = computed(() => props.message.metadata?.pollName || props.message.message || 'Enquete')
const choices = computed(() => props.message.metadata?.pollChoices || [])
const votes = computed(() => props.message.metadata?.pollVotes || {})
const totalVotes = computed(() => Object.values(votes.value).reduce((a, b) => a + b, 0))

function getVotePercent(choice: string): number {
  if (totalVotes.value === 0) return 0
  return Math.round(((votes.value[choice] || 0) / totalVotes.value) * 100)
}
</script>

<template>
  <div class="poll-message">
    <!-- Header -->
    <div class="flex items-center gap-1.5 mb-2">
      <BarChart3 class="w-3.5 h-3.5 opacity-70" />
      <span class="text-xs font-semibold uppercase tracking-wide opacity-70">Enquete</span>
    </div>

    <!-- Question -->
    <p class="text-sm font-medium mb-2.5">{{ pollName }}</p>

    <!-- Options -->
    <div class="space-y-1.5">
      <div
        v-for="choice in choices"
        :key="choice"
        class="relative rounded-lg overflow-hidden"
      >
        <!-- Background bar -->
        <div
          class="absolute inset-0 bg-current opacity-10 rounded-lg transition-all duration-300"
          :style="{ width: `${getVotePercent(choice)}%` }"
        />
        <!-- Content -->
        <div class="relative flex items-center justify-between px-3 py-1.5 text-sm">
          <span>{{ choice }}</span>
          <span v-if="totalVotes > 0" class="text-xs font-medium opacity-60">
            {{ getVotePercent(choice) }}%
          </span>
        </div>
      </div>
    </div>

    <!-- Total votes -->
    <p v-if="totalVotes > 0" class="text-[10px] mt-2 opacity-50">
      {{ totalVotes }} voto{{ totalVotes !== 1 ? 's' : '' }}
    </p>
  </div>
</template>
