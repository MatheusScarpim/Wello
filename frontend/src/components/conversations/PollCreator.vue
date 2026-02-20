<script setup lang="ts">
import { ref, computed } from 'vue'
import { X, Plus, Trash2, BarChart3, Send } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'send', poll: { name: string; choices: string[]; selectableCount?: number }): void
  (e: 'close'): void
}>()

const pollName = ref('')
const choices = ref(['', ''])
const selectableCount = ref<number | undefined>(undefined)

const canSend = computed(() => {
  return pollName.value.trim().length > 0 &&
    choices.value.filter(c => c.trim().length > 0).length >= 2
})

function addChoice() {
  if (choices.value.length < 12) {
    choices.value.push('')
  }
}

function removeChoice(idx: number) {
  if (choices.value.length > 2) {
    choices.value.splice(idx, 1)
  }
}

function sendPoll() {
  if (!canSend.value) return
  const validChoices = choices.value.filter(c => c.trim().length > 0)
  emit('send', {
    name: pollName.value.trim(),
    choices: validChoices,
    selectableCount: selectableCount.value,
  })
}
</script>

<template>
  <div class="poll-creator bg-white rounded-xl shadow-xl border border-gray-200 w-80 overflow-hidden" @click.stop>
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
      <div class="flex items-center gap-2">
        <BarChart3 class="w-4 h-4 text-primary-500" />
        <span class="text-sm font-medium text-gray-800">Criar Enquete</span>
      </div>
      <button @click="emit('close')" class="p-1 hover:bg-gray-100 rounded-lg text-gray-400">
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Body -->
    <div class="p-3 space-y-3 max-h-80 overflow-y-auto">
      <!-- Poll question -->
      <div>
        <label class="text-xs font-medium text-gray-500 mb-1 block">Pergunta</label>
        <input
          v-model="pollName"
          type="text"
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          placeholder="Faça uma pergunta..."
          maxlength="255"
        />
      </div>

      <!-- Choices -->
      <div>
        <label class="text-xs font-medium text-gray-500 mb-1 block">Opções</label>
        <div class="space-y-1.5">
          <div v-for="(_, idx) in choices" :key="idx" class="flex items-center gap-1.5">
            <input
              v-model="choices[idx]"
              type="text"
              class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              :placeholder="`Opção ${idx + 1}`"
              maxlength="100"
            />
            <button
              v-if="choices.length > 2"
              @click="removeChoice(idx)"
              class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <button
          v-if="choices.length < 12"
          @click="addChoice"
          class="flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <Plus class="w-3.5 h-3.5" />
          Adicionar opção
        </button>
      </div>

      <!-- Selectable count -->
      <div>
        <label class="text-xs font-medium text-gray-500 mb-1 block">Seleções permitidas (opcional)</label>
        <input
          v-model.number="selectableCount"
          type="number"
          min="1"
          :max="choices.length"
          class="w-20 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          placeholder="∞"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-end gap-2 px-3 py-2.5 border-t border-gray-100">
      <button @click="emit('close')" class="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
        Cancelar
      </button>
      <button
        @click="sendPoll"
        :disabled="!canSend"
        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send class="w-3.5 h-3.5" />
        Enviar
      </button>
    </div>
  </div>
</template>
