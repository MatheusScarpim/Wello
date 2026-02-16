<script setup lang="ts">
import { ref } from 'vue'
import { Sparkles, X, Loader2, Send } from 'lucide-vue-next'
import { iaApi } from '@/api'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { useToast } from 'vue-toastification'

const store = useBotBuilderStore()
const toast = useToast()

const isOpen = ref(false)
const prompt = ref('')
const isGenerating = ref(false)
const showConfirm = ref(false)

const examples = [
  'Bot de atendimento com menu de vendas, suporte e financeiro',
  'Agendamento de consultas com coleta de nome, telefone e data',
  'Pesquisa de satisfacao com notas de 1 a 5',
  'FAQ com respostas automaticas usando IA',
]

function toggle() {
  isOpen.value = !isOpen.value
}

function useExample(example: string) {
  prompt.value = example
}

async function handleGenerate() {
  if (!prompt.value.trim()) return

  // Se ja tem nos alem do start, pedir confirmacao
  const hasExistingNodes = store.nodes.length > 1 ||
    (store.nodes.length === 1 && store.nodes[0].type !== 'start')

  if (hasExistingNodes && !showConfirm.value) {
    showConfirm.value = true
    return
  }

  showConfirm.value = false
  await generate()
}

async function generate() {
  isGenerating.value = true

  try {
    const response = await iaApi.generateBot(prompt.value.trim())
    const { nodes, edges } = response.data

    store.loadGeneratedBot(nodes, edges)
    toast.success('Bot gerado com sucesso!')
    prompt.value = ''
    isOpen.value = false
  } catch (error: any) {
    const message = error?.response?.data?.message || 'Erro ao gerar bot. Tente novamente.'
    toast.error(message)
  } finally {
    isGenerating.value = false
  }
}

function cancelConfirm() {
  showConfirm.value = false
}
</script>

<template>
  <!-- Botao flutuante -->
  <button
    v-if="!isOpen"
    @click="toggle"
    class="absolute bottom-6 right-6 z-10 flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:shadow-xl"
    title="Gerar bot com IA"
  >
    <Sparkles class="w-5 h-5" />
    <span class="text-sm font-medium">Gerar com IA</span>
  </button>

  <!-- Painel -->
  <Transition name="slide-up">
    <div
      v-if="isOpen"
      class="absolute bottom-6 right-6 z-10 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4" />
          <span class="text-sm font-semibold">Assistente IA</span>
        </div>
        <button @click="toggle" class="p-1 hover:bg-indigo-500 rounded">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-4">
        <!-- Descricao -->
        <p class="text-xs text-gray-500 mb-3">
          Descreva o bot que voce quer criar e a IA vai gerar o fluxo completo automaticamente.
        </p>

        <!-- Textarea -->
        <textarea
          v-model="prompt"
          :disabled="isGenerating"
          placeholder="Ex: Crie um bot de atendimento com menu principal que tenha opcoes de vendas e suporte..."
          class="w-full h-28 px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
        />

        <!-- Exemplos -->
        <div class="mt-3 flex flex-wrap gap-1.5">
          <button
            v-for="example in examples"
            :key="example"
            @click="useExample(example)"
            :disabled="isGenerating"
            class="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-50"
          >
            {{ example }}
          </button>
        </div>

        <!-- Confirmacao de substituicao -->
        <div
          v-if="showConfirm"
          class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <p class="text-xs text-amber-800 mb-2">
            Isso vai substituir o fluxo atual. Deseja continuar?
          </p>
          <div class="flex gap-2">
            <button
              @click="generate"
              class="flex-1 text-xs px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
            >
              Sim, substituir
            </button>
            <button
              @click="cancelConfirm"
              class="flex-1 text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>

        <!-- Botao gerar -->
        <button
          v-if="!showConfirm"
          @click="handleGenerate"
          :disabled="!prompt.trim() || isGenerating"
          class="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Loader2 v-if="isGenerating" class="w-4 h-4 animate-spin" />
          <Send v-else class="w-4 h-4" />
          <span>{{ isGenerating ? 'Gerando seu bot...' : 'Gerar Bot' }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
