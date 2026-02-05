<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Sparkles class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Assistente IA</h1>
          <p class="text-gray-500 text-sm">Sugestoes inteligentes para seus atendimentos</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Company Explanation Card -->
      <div class="card">
        <div class="card-body">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Building2 class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Sobre sua Empresa</h2>
              <p class="text-sm text-gray-500">Informacoes para contextualizar a IA</p>
            </div>
          </div>

          <div v-if="!isEditingCompany" class="space-y-4">
            <div
              class="p-4 bg-gray-50 rounded-xl border border-gray-100 min-h-[200px] whitespace-pre-wrap text-gray-700"
              v-if="companyDescription"
            >
              {{ companyDescription }}
            </div>
            <div
              v-else
              class="p-4 bg-gray-50 rounded-xl border border-gray-200 border-dashed min-h-[200px] flex items-center justify-center text-gray-400"
            >
              <div class="text-center">
                <FileText class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma descricao cadastrada</p>
                <p class="text-sm">Adicione informacoes sobre sua empresa</p>
              </div>
            </div>
            <button
              @click="isEditingCompany = true"
              class="btn btn-primary w-full"
            >
              <Pencil class="w-4 h-4 mr-2" />
              {{ companyDescription ? 'Editar Descricao' : 'Adicionar Descricao' }}
            </button>
          </div>

          <div v-else class="space-y-4">
            <textarea
              v-model="editingCompanyDescription"
              class="textarea w-full min-h-[200px]"
              placeholder="Descreva sua empresa, produtos, servicos, horarios de funcionamento, politicas, e qualquer informacao relevante que a IA deve saber para ajudar nos atendimentos..."
            ></textarea>
            <div class="flex gap-3">
              <button
                @click="cancelEditCompany"
                class="btn btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                @click="saveCompanyDescription"
                class="btn btn-primary flex-1"
                :disabled="isSavingCompany"
              >
                <Loader2 v-if="isSavingCompany" class="w-4 h-4 mr-2 animate-spin" />
                <Check v-else class="w-4 h-4 mr-2" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Suggestion Instructions Card -->
      <div class="card">
        <div class="card-body">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <Wand2 class="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Instrucoes para Sugestoes</h2>
              <p class="text-sm text-gray-500">Defina como a IA deve responder</p>
            </div>
          </div>

          <div v-if="!isEditingInstructions" class="space-y-4">
            <div
              class="p-4 bg-gray-50 rounded-xl border border-gray-100 min-h-[200px] whitespace-pre-wrap text-gray-700"
              v-if="suggestionInstructions"
            >
              {{ suggestionInstructions }}
            </div>
            <div
              v-else
              class="p-4 bg-gray-50 rounded-xl border border-gray-200 border-dashed min-h-[200px] flex items-center justify-center text-gray-400"
            >
              <div class="text-center">
                <Wand2 class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma instrucao cadastrada</p>
                <p class="text-sm">Defina como a IA deve gerar as sugestoes</p>
              </div>
            </div>
            <button
              @click="startEditInstructions"
              class="btn btn-primary w-full"
            >
              <Pencil class="w-4 h-4 mr-2" />
              {{ suggestionInstructions ? 'Editar Instrucoes' : 'Adicionar Instrucoes' }}
            </button>
          </div>

          <div v-else class="space-y-4">
            <textarea
              v-model="editingSuggestionInstructions"
              class="textarea w-full min-h-[200px]"
              placeholder="Ex: Sempre cumprimente o cliente pelo nome. Use emojis quando apropriado. Ofereca ajuda adicional ao final. Mencione promocoes ativas. Seja informal mas profissional..."
            ></textarea>
            <div class="flex gap-3">
              <button
                @click="cancelEditInstructions"
                class="btn btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                @click="saveSuggestionInstructions"
                class="btn btn-primary flex-1"
                :disabled="isSavingInstructions"
              >
                <Loader2 v-if="isSavingInstructions" class="w-4 h-4 mr-2 animate-spin" />
                <Check v-else class="w-4 h-4 mr-2" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- AI Suggestions Card -->
      <div class="card">
        <div class="card-body">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
              <BrainCircuit class="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Sugestoes da IA</h2>
              <p class="text-sm text-gray-500">Respostas sugeridas para o atendimento</p>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-if="!currentSuggestion && !isThinking"
            class="flex flex-col items-center justify-center py-12 text-gray-400"
          >
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center mb-4">
              <MessageSquareText class="w-10 h-10 text-purple-300" />
            </div>
            <p class="font-medium text-gray-500">Aguardando sugestao</p>
            <p class="text-sm text-center mt-1 max-w-xs">
              Quando voce solicitar uma sugestao no chat, ela aparecera aqui
            </p>
          </div>

          <!-- Thinking Animation -->
          <div
            v-if="isThinking"
            class="space-y-4"
          >
            <div class="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-purple-100">
              <div class="relative">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Sparkles class="w-5 h-5 text-white animate-pulse" />
                </div>
                <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white flex items-center justify-center">
                  <div class="w-2 h-2 rounded-full bg-white animate-ping"></div>
                </div>
              </div>
              <div class="flex-1">
                <p class="font-medium text-purple-900">Pensando junto com voce...</p>
                <p class="text-sm text-purple-600">Analisando o contexto da conversa</p>
              </div>
            </div>

            <!-- Thinking Steps Animation -->
            <div class="space-y-3 pl-4 border-l-2 border-purple-200">
              <div
                v-for="(step, index) in thinkingSteps"
                :key="index"
                class="flex items-center gap-3 animate-fade-in"
                :style="{ animationDelay: `${index * 0.3}s` }"
              >
                <div
                  class="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
                  :class="step.completed ? 'bg-green-100' : 'bg-purple-100'"
                >
                  <Check v-if="step.completed" class="w-4 h-4 text-green-600" />
                  <Loader2 v-else class="w-4 h-4 text-purple-500 animate-spin" />
                </div>
                <span
                  class="text-sm transition-colors duration-300"
                  :class="step.completed ? 'text-gray-600' : 'text-purple-700 font-medium'"
                >
                  {{ step.text }}
                </span>
              </div>
            </div>
          </div>

          <!-- Suggestion Display -->
          <div
            v-if="currentSuggestion && !isThinking"
            class="space-y-4"
          >
            <!-- Suggestion Header -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-green-500"></div>
                <span class="text-sm font-medium text-gray-600">Sugestao pronta</span>
              </div>
              <span class="text-xs text-gray-400">{{ suggestionTime }}</span>
            </div>

            <!-- Suggestion Content -->
            <div class="relative group">
              <div class="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl opacity-5 group-hover:opacity-10 transition-opacity"></div>
              <div class="relative p-5 bg-white rounded-xl border border-purple-100 shadow-sm">
                <div class="flex items-start gap-3 mb-3">
                  <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles class="w-4 h-4 text-white" />
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">Sugestao de Resposta</p>
                    <p class="text-xs text-gray-500">Baseada no contexto da conversa</p>
                  </div>
                </div>

                <div class="pl-11">
                  <p class="text-gray-700 whitespace-pre-wrap leading-relaxed">{{ currentSuggestion }}</p>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2 mt-4 pl-11">
                  <button
                    @click="copySuggestion"
                    class="btn btn-outline btn-sm flex-1"
                  >
                    <Copy class="w-4 h-4 mr-2" />
                    Copiar
                  </button>
                  <button
                    @click="clearSuggestion"
                    class="btn btn-ghost btn-sm"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Confidence Indicator -->
            <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-medium text-gray-600">Nivel de confianca</span>
                  <span class="text-xs font-semibold text-purple-600">{{ confidenceLevel }}%</span>
                </div>
                <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                    :style="{ width: `${confidenceLevel}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tips Section -->
    <div class="card bg-gradient-to-r from-violet-50 to-purple-50 border-purple-100">
      <div class="card-body">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <Lightbulb class="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Como usar o Assistente IA</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                Durante uma conversa, clique no botao de sugestao da IA
              </li>
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                A IA analisara o contexto e gerara uma resposta personalizada
              </li>
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                Revise a sugestao e adapte conforme necessario antes de enviar
              </li>
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                Quanto mais detalhada a descricao da empresa, melhores as sugestoes
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import {
  Sparkles,
  Building2,
  FileText,
  Pencil,
  Check,
  Loader2,
  BrainCircuit,
  MessageSquareText,
  Copy,
  X,
  Lightbulb,
  Wand2
} from 'lucide-vue-next'
import { iaApi } from '@/api'

const toast = useToast()

// Company description state
const companyDescription = ref('')
const editingCompanyDescription = ref('')
const isEditingCompany = ref(false)
const isSavingCompany = ref(false)

// Suggestion instructions state
const suggestionInstructions = ref('')
const editingSuggestionInstructions = ref('')
const isEditingInstructions = ref(false)
const isSavingInstructions = ref(false)

// AI suggestion state
const currentSuggestion = ref('')
const isThinking = ref(false)
const suggestionTime = ref('')
const confidenceLevel = ref(85)

const thinkingSteps = ref([
  { text: 'Lendo historico da conversa', completed: false },
  { text: 'Analisando contexto do cliente', completed: false },
  { text: 'Consultando base de conhecimento', completed: false },
  { text: 'Gerando resposta personalizada', completed: false }
])

// Load company description
const loadCompanyDescription = async () => {
  try {
    const response = await iaApi.getCompanyDescription()
    companyDescription.value = response.data?.description || ''
  } catch (error) {
    console.error('Error loading company description:', error)
  }
}

// Save company description
const saveCompanyDescription = async () => {
  isSavingCompany.value = true
  try {
    await iaApi.saveCompanyDescription(editingCompanyDescription.value)
    companyDescription.value = editingCompanyDescription.value
    isEditingCompany.value = false
    toast.success('Descricao salva com sucesso!')
  } catch (error) {
    console.error('Error saving company description:', error)
    toast.error('Erro ao salvar descricao')
  } finally {
    isSavingCompany.value = false
  }
}

// Load suggestion instructions
const loadSuggestionInstructions = async () => {
  try {
    const response = await iaApi.getSuggestionInstructions()
    suggestionInstructions.value = response.data?.instructions || ''
  } catch (error) {
    console.error('Error loading suggestion instructions:', error)
  }
}

// Save suggestion instructions
const saveSuggestionInstructions = async () => {
  isSavingInstructions.value = true
  try {
    await iaApi.saveSuggestionInstructions(editingSuggestionInstructions.value)
    suggestionInstructions.value = editingSuggestionInstructions.value
    isEditingInstructions.value = false
    toast.success('Instrucoes salvas com sucesso!')
  } catch (error) {
    console.error('Error saving suggestion instructions:', error)
    toast.error('Erro ao salvar instrucoes')
  } finally {
    isSavingInstructions.value = false
  }
}

// Cancel edit instructions
const cancelEditInstructions = () => {
  editingSuggestionInstructions.value = suggestionInstructions.value
  isEditingInstructions.value = false
}

// Start editing instructions
const startEditInstructions = () => {
  editingSuggestionInstructions.value = suggestionInstructions.value
  isEditingInstructions.value = true
}

// Cancel edit
const cancelEditCompany = () => {
  editingCompanyDescription.value = companyDescription.value
  isEditingCompany.value = false
}

// Start editing
const startEditCompany = () => {
  editingCompanyDescription.value = companyDescription.value
  isEditingCompany.value = true
}

// Copy suggestion to clipboard
const copySuggestion = async () => {
  try {
    await navigator.clipboard.writeText(currentSuggestion.value)
    toast.success('Sugestao copiada!')
  } catch (error) {
    toast.error('Erro ao copiar')
  }
}

// Clear suggestion
const clearSuggestion = () => {
  currentSuggestion.value = ''
}

// Handle incoming suggestion from chat
const handleSuggestionEvent = (event: CustomEvent) => {
  const { suggestion, thinking } = event.detail

  if (thinking) {
    isThinking.value = true
    currentSuggestion.value = ''

    // Animate thinking steps
    thinkingSteps.value = thinkingSteps.value.map(s => ({ ...s, completed: false }))

    thinkingSteps.value.forEach((step, index) => {
      setTimeout(() => {
        thinkingSteps.value[index].completed = true
      }, (index + 1) * 800)
    })
  } else if (suggestion) {
    setTimeout(() => {
      isThinking.value = false
      currentSuggestion.value = suggestion
      suggestionTime.value = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
      confidenceLevel.value = Math.floor(Math.random() * 15) + 80 // 80-95%
    }, 500)
  }
}

onMounted(() => {
  loadCompanyDescription()
  loadSuggestionInstructions()
  window.addEventListener('ia:suggestion', handleSuggestionEvent as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('ia:suggestion', handleSuggestionEvent as EventListener)
})
</script>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out forwards;
  opacity: 0;
}

.btn-sm {
  @apply py-1.5 px-3 text-sm;
}
</style>
