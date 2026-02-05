<script setup lang="ts">
defineProps<{
  size?: 'sm' | 'md' | 'lg'
}>()
</script>

<template>
  <div
    class="animate-spin rounded-full border-2 border-current border-t-transparent"
    :class="{
      'w-4 h-4': size === 'sm',
      'w-6 h-6': size === 'md' || !size,
      'w-8 h-8': size === 'lg'
    }"
  />
</template>
