<script setup lang="ts">
import { computed } from 'vue'
import AuraChart from '@/components/aura/AuraChart.vue'
import AuraTable from '@/components/aura/AuraTable.vue'
import type { AuraWebhookResponse } from '@/types/aura'

const props = defineProps<{
  response: AuraWebhookResponse
}>()

const hasChart = computed(() => Boolean(props.response.chart?.data?.length))
const hasTable = computed(() => Boolean(props.response.rows?.length))
const displayText = computed(() => props.response.summary || props.response.message)
</script>

<template>
  <div class="space-y-3">
    <p v-if="displayText" class="text-sm text-gray-700">
      {{ displayText }}
    </p>

    <div
      v-if="hasChart"
      class="rounded-xl border border-gray-200 bg-white p-3"
    >
      <AuraChart :chart="response.chart!" />
    </div>

    <div
      v-if="hasTable"
      class="rounded-xl border border-gray-200 bg-white p-3"
    >
      <AuraTable
        :rows="response.rows ?? []"
        :columns="response.columns"
      />
    </div>
  </div>
</template>
