<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
          <Bot class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Agente IA</h1>
          <p class="text-gray-500 text-sm">Atendente virtual que conversa como um humano</p>
        </div>
      </div>

      <!-- Toggle On/Off -->
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium" :class="config.agentEnabled ? 'text-emerald-600' : 'text-gray-400'">
          {{ config.agentEnabled ? 'Ativo' : 'Desativado' }}
        </span>
        <button
          @click="toggleAgent"
          class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200"
          :class="config.agentEnabled ? 'bg-emerald-500' : 'bg-gray-300'"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200"
            :class="config.agentEnabled ? 'translate-x-6' : 'translate-x-1'"
          />
        </button>
      </div>
    </div>

    <!-- Status Banner -->
    <div
      v-if="config.agentEnabled"
      class="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center gap-3"
    >
      <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
      <p class="text-sm text-emerald-800">
        O agente IA está ativo e respondendo automaticamente as conversas sem operador atribuído.
        Quando necessário, ele transfere para um atendente humano.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Personality / System Prompt -->
      <div class="card">
        <div class="card-body">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <UserCog class="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Personalidade e Instruções</h2>
              <p class="text-sm text-gray-500">Como o agente deve se comportar e o que saber</p>
            </div>
          </div>

          <div class="space-y-4">
            <textarea
              v-model="config.agentSystemPrompt"
              class="textarea w-full min-h-[250px]"
              placeholder="Ex: Você é a Julia, atendente da loja XYZ. Você conhece todos os produtos e preços. Seja simpática e use linguagem informal. Quando o cliente quiser comprar, peça o endereço e forma de pagamento..."
            ></textarea>
            <p class="text-xs text-gray-400">
              Dica: Quanto mais detalhado, melhor. Inclua nome do atendente, produtos, preços, horários, políticas, etc.
            </p>
          </div>
        </div>
      </div>

      <!-- Transfer Settings -->
      <div class="card">
        <div class="card-body">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <ArrowRightLeft class="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Transferência para Humano</h2>
              <p class="text-sm text-gray-500">Quando o agente deve passar para um atendente</p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Instruções de transferência</label>
              <textarea
                v-model="config.agentTransferInstructions"
                class="textarea w-full min-h-[100px]"
                placeholder="Ex: Transfira quando o cliente pedir desconto acima de 20%. Transfira assuntos de garantia e trocas..."

              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Palavras-chave de transferência imediata</label>
              <div class="flex flex-wrap gap-2 mb-2">
                <span
                  v-for="(keyword, index) in config.agentTransferKeywords"
                  :key="index"
                  class="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-full"
                >
                  {{ keyword }}
                  <button @click="removeKeyword(index)" class="hover:text-orange-900">
                    <X class="w-3 h-3" />
                  </button>
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="newKeyword"
                  @keyup.enter="addKeyword"
                  class="input flex-1"
                  placeholder="Digite e pressione Enter"
                />
                <button @click="addKeyword" class="btn btn-outline btn-sm">
                  <Plus class="w-4 h-4" />
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                Se o cliente enviar uma mensagem contendo essas palavras, será transferido imediatamente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Audio Response -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Mic class="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Responder com Áudio</h2>
              <p class="text-sm text-gray-500">Quando o cliente envia áudio, o agente responde com áudio também</p>
            </div>
          </div>
          <button
            @click="config.agentReplyWithAudio = !config.agentReplyWithAudio"
            class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200"
            :class="config.agentReplyWithAudio ? 'bg-indigo-500' : 'bg-gray-300'"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200"
              :class="config.agentReplyWithAudio ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
        <p v-if="config.agentReplyWithAudio" class="text-xs text-indigo-600 mt-3 ml-13">
          O agente irá transcrever o áudio do cliente, gerar a resposta e convertê-la em áudio usando a voz configurada em Personalização.
        </p>
      </div>
    </div>

    <!-- Advanced Settings -->
    <div class="card">
      <div class="card-body">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <Settings class="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Configurações Avançadas</h2>
            <p class="text-sm text-gray-500">Ajustes finos do modelo de IA</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
            <select v-model="config.agentModel" class="input w-full">
              <option value="gpt-4o-mini">GPT-4o Mini (rápido)</option>
              <option value="gpt-4o">GPT-4o (avançado)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (econômico)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Criatividade: {{ (config.agentTemperature * 100).toFixed(0) }}%
            </label>
            <input
              type="range"
              v-model.number="config.agentTemperature"
              min="0"
              max="1"
              step="0.1"
              class="w-full mt-2"
            />
            <div class="flex justify-between text-xs text-gray-400">
              <span>Preciso</span>
              <span>Criativo</span>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Max tokens</label>
            <input
              type="number"
              v-model.number="config.agentMaxTokens"
              class="input w-full"
              min="100"
              max="2000"
              step="50"
            />
            <p class="text-xs text-gray-400 mt-1">Tamanho máx. da resposta</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Histórico de mensagens</label>
            <input
              type="number"
              v-model.number="config.agentHistoryLimit"
              class="input w-full"
              min="5"
              max="100"
              step="5"
            />
            <p class="text-xs text-gray-400 mt-1">Quantas mensagens anteriores enviar</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Save Button -->
    <div class="flex justify-end">
      <button
        @click="saveConfig"
        class="btn btn-primary px-8"
        :disabled="isSaving"
      >
        <Loader2 v-if="isSaving" class="w-4 h-4 mr-2 animate-spin" />
        <Check v-else class="w-4 h-4 mr-2" />
        Salvar Configurações
      </button>
    </div>

    <!-- Tips -->
    <div class="card bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
      <div class="card-body">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <Lightbulb class="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 mb-2">Como funciona o Agente IA</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                O agente conversa automaticamente com clientes que não têm operador atribuído
              </li>
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                Ele usa as informações da empresa e as instruções que você configurar
              </li>
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                Quando achar necessário, transfere para um atendente humano automaticamente
              </li>
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                Você pode assumir a conversa a qualquer momento — basta se atribuir a ela
              </li>
              <li class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                Quanto mais detalhadas as instruções, mais natural e preciso o agente será
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import {
  Bot,
  UserCog,
  ArrowRightLeft,
  Settings,
  Check,
  Loader2,
  X,
  Plus,
  Lightbulb,
  Mic,
} from 'lucide-vue-next'
import { iaApi } from '@/api'

const toast = useToast()

const config = reactive({
  agentEnabled: false,
  agentSystemPrompt: '',
  agentModel: 'gpt-4o-mini',
  agentTemperature: 0.8,
  agentMaxTokens: 400,
  agentHistoryLimit: 30,
  agentTransferKeywords: [] as string[],
  agentTransferInstructions: '',
  agentReplyWithAudio: false,
})

const isSaving = ref(false)
const isLoading = ref(true)
const newKeyword = ref('')

const loadConfig = async () => {
  isLoading.value = true
  try {
    const response = await iaApi.getAgentConfig()
    const data = response.data as any
    if (data) {
      config.agentEnabled = data.agentEnabled ?? false
      config.agentSystemPrompt = data.agentSystemPrompt || ''
      config.agentModel = data.agentModel || 'gpt-4o-mini'
      config.agentTemperature = data.agentTemperature ?? 0.8
      config.agentMaxTokens = data.agentMaxTokens ?? 400
      config.agentHistoryLimit = data.agentHistoryLimit ?? 30
      config.agentTransferKeywords = data.agentTransferKeywords || []
      config.agentTransferInstructions = data.agentTransferInstructions || ''
      config.agentReplyWithAudio = data.agentReplyWithAudio ?? false
    }
  } catch (error) {
    console.error('Erro ao carregar config do agente:', error)
  } finally {
    isLoading.value = false
  }
}

const saveConfig = async () => {
  isSaving.value = true
  try {
    await iaApi.saveAgentConfig({ ...config })
    toast.success('Configurações do agente salvas com sucesso!')
  } catch (error) {
    console.error('Erro ao salvar config do agente:', error)
    toast.error('Erro ao salvar configurações')
  } finally {
    isSaving.value = false
  }
}

const toggleAgent = async () => {
  config.agentEnabled = !config.agentEnabled
  try {
    await iaApi.saveAgentConfig({ agentEnabled: config.agentEnabled })
    toast.success(config.agentEnabled ? 'Agente IA ativado!' : 'Agente IA desativado')
  } catch (error) {
    config.agentEnabled = !config.agentEnabled
    toast.error('Erro ao alterar status do agente')
  }
}

const addKeyword = () => {
  const keyword = newKeyword.value.trim()
  if (keyword && !config.agentTransferKeywords.includes(keyword)) {
    config.agentTransferKeywords.push(keyword)
    newKeyword.value = ''
  }
}

const removeKeyword = (index: number) => {
  config.agentTransferKeywords.splice(index, 1)
}

onMounted(() => {
  loadConfig()
})
</script>
