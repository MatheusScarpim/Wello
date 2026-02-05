<script setup lang="ts">
import { X, AlertTriangle } from 'lucide-vue-next'

defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
      <div class="p-6">
        <div class="flex items-start gap-4">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            :class="{
              'bg-red-100': variant === 'danger',
              'bg-yellow-100': variant === 'warning',
              'bg-blue-100': variant === 'info' || !variant
            }"
          >
            <AlertTriangle
              class="w-6 h-6"
              :class="{
                'text-red-600': variant === 'danger',
                'text-yellow-600': variant === 'warning',
                'text-blue-600': variant === 'info' || !variant
              }"
            />
          </div>

          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-1">
              {{ title }}
            </h3>
            <p class="text-sm text-gray-500">
              {{ message }}
            </p>
          </div>

          <button
            @click="emit('cancel')"
            class="p-2 rounded-lg hover:bg-gray-100 -mt-2 -mr-2"
          >
            <X class="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            @click="emit('cancel')"
            :disabled="isLoading"
            class="btn-secondary flex-1"
          >
            {{ cancelText || 'Cancelar' }}
          </button>
          <button
            @click="emit('confirm')"
            :disabled="isLoading"
            class="flex-1"
            :class="{
              'btn-danger': variant === 'danger',
              'btn-primary': variant !== 'danger'
            }"
          >
            {{ isLoading ? 'Aguarde...' : (confirmText || 'Confirmar') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
