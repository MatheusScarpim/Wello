<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'select', emoji: string): void
  (e: 'close'): void
}>()

const frequentEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏']

const categories = [
  { label: 'Frequentes', emojis: frequentEmojis },
  { label: 'Sorrisos', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😎', '🤓', '🧐', '🤔', '🤫', '🤭', '🥳', '😏'] },
  { label: 'Gestos', emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👊', '✊', '🤜', '🤛', '👏', '🙌', '🤲', '🤝', '🙏', '💪', '🫶'] },
  { label: 'Objetos', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '⭐', '🌟', '✨', '💥', '🔥', '🎉', '🎊', '💐', '🌹'] },
]

const activeCategory = ref(0)

function selectEmoji(emoji: string) {
  emit('select', emoji)
}
</script>

<template>
  <div class="emoji-picker bg-white rounded-xl shadow-xl border border-gray-200 w-72 overflow-hidden" @click.stop>
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100">
      <span class="text-xs font-medium text-gray-500">Reagir</span>
      <button @click="emit('close')" class="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Quick reactions -->
    <div class="flex items-center justify-around px-2 py-2.5 border-b border-gray-50">
      <button
        v-for="emoji in frequentEmojis"
        :key="emoji"
        @click="selectEmoji(emoji)"
        class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-110 transition-all text-xl"
      >
        {{ emoji }}
      </button>
    </div>

    <!-- Category tabs -->
    <div class="flex gap-1 px-2 pt-2 border-b border-gray-50">
      <button
        v-for="(cat, idx) in categories"
        :key="cat.label"
        @click="activeCategory = idx"
        class="px-2 py-1 text-[10px] font-medium rounded-t-lg transition-colors"
        :class="activeCategory === idx ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-500' : 'text-gray-400 hover:text-gray-600'"
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- Emoji grid -->
    <div class="p-2 max-h-40 overflow-y-auto">
      <div class="grid grid-cols-8 gap-0.5">
        <button
          v-for="emoji in categories[activeCategory].emojis"
          :key="emoji"
          @click="selectEmoji(emoji)"
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 active:scale-110 transition-all text-lg"
        >
          {{ emoji }}
        </button>
      </div>
    </div>
  </div>
</template>
