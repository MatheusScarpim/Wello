<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { visualBotsApi } from '@/api'
import { X, Send, RotateCcw, Loader2 } from 'lucide-vue-next'

const store = useBotBuilderStore()

interface ChatMessage {
  role: 'user' | 'bot'
  text?: string
  buttons?: any
  list?: any
  media?: any
}

const messages = ref<ChatMessage[]>([])
const input = ref('')
const sessionData = ref<Record<string, any>>({})
const isProcessing = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const hasEnded = ref(false)

function close() {
  store.showTestPanel = false
}

function resetChat() {
  messages.value = []
  sessionData.value = {}
  input.value = ''
  hasEnded.value = false
}

async function scrollToBottom() {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

async function sendMessage(text?: string) {
  const messageText = text || input.value.trim()
  if (!messageText || !store.definitionId || isProcessing.value || hasEnded.value) return

  // Adicionar mensagem do usuario
  messages.value.push({ role: 'user', text: messageText })
  input.value = ''
  isProcessing.value = true
  await scrollToBottom()

  try {
    // Salvar antes de testar para garantir estado atualizado
    if (store.isDirty) {
      await store.save()
    }

    const response = await visualBotsApi.test(
      store.definitionId,
      messageText,
      sessionData.value,
    )

    const data = response.data

    // Adicionar respostas do bot
    if (data.responses && data.responses.length > 0) {
      for (const resp of data.responses) {
        const msg: ChatMessage = { role: 'bot' }
        if (resp.message) msg.text = resp.message
        if (resp.buttons) msg.buttons = resp.buttons
        if (resp.list) msg.list = resp.list
        if (resp.media) msg.media = resp.media
        messages.value.push(msg)
      }
    }

    // Atualizar sessionData para a proxima mensagem
    if (data.sessionData) {
      sessionData.value = data.sessionData
    }

    if (data.endSession) {
      hasEnded.value = true
      messages.value.push({
        role: 'bot',
        text: '--- Conversa finalizada ---',
      })
    }
  } catch (error: any) {
    messages.value.push({
      role: 'bot',
      text: `Erro: ${error?.response?.data?.error || error.message}`,
    })
  } finally {
    isProcessing.value = false
    await scrollToBottom()
  }
}

function handleButtonClick(buttonId: string, buttonText: string) {
  sendMessage(buttonText)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// Iniciar conversa automaticamente (enviar mensagem vazia para disparar o Start)
async function startConversation() {
  if (!store.definitionId) return
  isProcessing.value = true

  try {
    if (store.isDirty) {
      await store.save()
    }

    const response = await visualBotsApi.test(
      store.definitionId,
      '__start__',
      {},
    )

    const data = response.data

    if (data.responses && data.responses.length > 0) {
      for (const resp of data.responses) {
        const msg: ChatMessage = { role: 'bot' }
        if (resp.message) msg.text = resp.message
        if (resp.buttons) msg.buttons = resp.buttons
        if (resp.list) msg.list = resp.list
        if (resp.media) msg.media = resp.media
        messages.value.push(msg)
      }
    }

    if (data.sessionData) {
      sessionData.value = data.sessionData
    }
  } catch {
    // Silenciar erro no start
  } finally {
    isProcessing.value = false
    await scrollToBottom()
  }
}

// Auto-start ao abrir
startConversation()
</script>

<template>
  <div class="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-sm text-gray-700">Testar Bot</span>
        <span class="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-600">
          Preview
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="resetChat"
          class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title="Reiniciar conversa"
        >
          <RotateCcw class="w-4 h-4 text-gray-400" />
        </button>
        <button
          @click="close"
          class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X class="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>

    <!-- Chat Messages -->
    <div
      ref="chatContainer"
      class="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50"
    >
      <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
        <p class="text-xs text-gray-400 text-center">
          Iniciando conversa de teste...
        </p>
      </div>

      <div
        v-for="(msg, i) in messages"
        :key="i"
        class="flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[85%] rounded-xl px-3 py-2 text-sm"
          :class="msg.role === 'user'
            ? 'bg-primary-600 text-white rounded-br-sm'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'"
        >
          <!-- Text -->
          <p v-if="msg.text" class="whitespace-pre-wrap">{{ msg.text }}</p>

          <!-- Buttons -->
          <div v-if="msg.buttons" class="mt-2 space-y-1.5">
            <p v-if="msg.buttons.title" class="font-medium text-xs">{{ msg.buttons.title }}</p>
            <p v-if="msg.buttons.description" class="text-xs opacity-80">{{ msg.buttons.description }}</p>
            <div class="space-y-1">
              <button
                v-for="btn in msg.buttons.buttons"
                :key="btn.id"
                @click="handleButtonClick(btn.id, btn.text)"
                :disabled="isProcessing || hasEnded"
                class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ btn.text }}
              </button>
            </div>
          </div>

          <!-- List -->
          <div v-if="msg.list" class="mt-2 space-y-1.5">
            <p v-if="msg.list.title" class="font-medium text-xs">{{ msg.list.title }}</p>
            <p v-if="msg.list.description" class="text-xs opacity-80">{{ msg.list.description }}</p>
            <div v-for="section in msg.list.sections" :key="section.title" class="space-y-1 mt-1">
              <p class="text-[10px] font-semibold text-gray-500 uppercase">{{ section.title }}</p>
              <button
                v-for="row in section.rows"
                :key="row.rowId"
                @click="handleButtonClick(row.rowId, row.title)"
                :disabled="isProcessing || hasEnded"
                class="w-full text-left px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ row.title }}
                <span v-if="row.description" class="block text-[10px] text-gray-400">{{ row.description }}</span>
              </button>
            </div>
          </div>

          <!-- Media -->
          <div v-if="msg.media" class="mt-1">
            <div class="bg-gray-100 rounded-lg p-2 text-xs text-gray-500">
              [{{ msg.media.type }}] {{ msg.media.caption || msg.media.url }}
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isProcessing" class="flex justify-start">
        <div class="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-3 py-2 shadow-sm">
          <Loader2 class="w-4 h-4 text-gray-400 animate-spin" />
        </div>
      </div>
    </div>

    <!-- Input -->
    <div class="p-3 border-t border-gray-200 bg-white">
      <div class="flex items-center gap-2">
        <input
          v-model="input"
          @keydown="handleKeydown"
          :disabled="isProcessing || hasEnded"
          type="text"
          placeholder="Digite uma mensagem..."
          class="flex-1 input text-sm"
        />
        <button
          @click="sendMessage()"
          :disabled="!input.trim() || isProcessing || hasEnded"
          class="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send class="w-4 h-4" />
        </button>
      </div>
      <p v-if="hasEnded" class="text-[10px] text-gray-400 text-center mt-1">
        Conversa finalizada. Clique no botão de reiniciar para testar novamente.
      </p>
    </div>
  </div>
</template>
