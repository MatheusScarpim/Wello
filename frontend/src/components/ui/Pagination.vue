<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { Pagination } from '@/types'

const props = defineProps<{
  pagination: Pagination
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()

const pages = computed(() => {
  const { page, totalPages } = props.pagination
  const delta = 2
  const range: (number | string)[] = []

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= page - delta && i <= page + delta)
    ) {
      range.push(i)
    } else if (range[range.length - 1] !== '...') {
      range.push('...')
    }
  }

  return range
})

function goToPage(page: number) {
  if (page >= 1 && page <= props.pagination.totalPages) {
    emit('page-change', page)
  }
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 sm:px-0">
    <div class="flex flex-1 justify-between sm:hidden">
      <button
        @click="goToPage(pagination.page - 1)"
        :disabled="pagination.page <= 1"
        class="btn-outline btn-sm"
      >
        Anterior
      </button>
      <button
        @click="goToPage(pagination.page + 1)"
        :disabled="pagination.page >= pagination.totalPages"
        class="btn-outline btn-sm"
      >
        Próximo
      </button>
    </div>

    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <p class="text-sm text-gray-500">
        Mostrando
        <span class="font-medium">{{ ((pagination.page - 1) * pagination.pageSize) + 1 }}</span>
        até
        <span class="font-medium">{{ Math.min(pagination.page * pagination.pageSize, pagination.total) }}</span>
        de
        <span class="font-medium">{{ pagination.total }}</span>
        resultados
      </p>

      <nav class="flex items-center gap-1">
        <button
          @click="goToPage(pagination.page - 1)"
          :disabled="pagination.page <= 1"
          class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>

        <button
          v-for="p in pages"
          :key="p"
          @click="typeof p === 'number' && goToPage(p)"
          :disabled="p === '...'"
          class="min-w-[40px] h-10 px-3 rounded-lg text-sm font-medium transition-colors"
          :class="[
            p === pagination.page
              ? 'bg-primary-600 text-white'
              : p === '...'
              ? 'cursor-default text-gray-400'
              : 'hover:bg-gray-100 text-gray-700'
          ]"
        >
          {{ p }}
        </button>

        <button
          @click="goToPage(pagination.page + 1)"
          :disabled="pagination.page >= pagination.totalPages"
          class="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </nav>
    </div>
  </div>
</template>
