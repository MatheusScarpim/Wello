<script setup lang="ts">
import { ref, watch } from 'vue'
import { messagesApi, tagsApi, queueApi } from '@/api'
import { X, Clock, MessageSquare, Image, FileText, Mic, Video, Play, Tag, Plus, Check, Smartphone } from 'lucide-vue-next'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { useToast } from 'vue-toastification'
import type { QueueItem, Message, Tag as TagType } from '@/types'

const toast = useToast()

const props = defineProps<{
  item: QueueItem | null
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  claim: [item: QueueItem]
  tagsUpdated: [tags: string[]]
}>()

const messages = ref<Message[]>([])
const isLoading = ref(false)
const availableTags = ref<TagType[]>([])
const localTags = ref<string[]>([])
const showTagsDropdown = ref(false)

watch(() => [props.item, props.open], async ([newItem, isOpen]) => {
  if (newItem && isOpen) {
    await fetchMessages((newItem as QueueItem).conversation._id)
  }
}, { immediate: true })

async function fetchMessages(conversationId: string) {
  isLoading.value = true
  messages.value = []
  try {
    const response = await messagesApi.list({
      conversationId,
      limit: 20
    })
    if (response.data) {
      messages.value = [...response.data.items].reverse()
    }
  } catch (error) {
    console.error('Erro ao carregar mensagens:', error)
  } finally {
    isLoading.value = false
  }
}

function formatTime(date?: string) {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatWaitTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function getMessageIcon(type: string) {
  switch (type) {
    case 'image': return Image
    case 'document': return FileText
    case 'audio':
    case 'ptt': return Mic
    case 'video': return Video
    default: return MessageSquare
  }
}

function getMessagePreview(message: Message) {
  if (message.type === 'text' || message.type === 'chat') return message.message
  if (message.type === 'image') return '[Imagem]'
  if (message.type === 'audio' || message.type === 'ptt') return '[Audio]'
  if (message.type === 'video') return '[Video]'
  if (message.type === 'document') return `[Documento: ${message.filename || 'arquivo'}]`
  if (message.type === 'system') return message.message
  if (message.type === 'list') {
    return (message as any).metadata?.title || message.message || 'Mensagem de lista'
  }
  if (message.type === 'buttons') {
    return (message as any).metadata?.title || message.message || 'Mensagem de botões'
  }
  return `[${message.type}]`
}

function getQuotedMessage(message: Message): Message | null {
  if (!message.quotedMessageId) return null
  return messages.value.find(m => m._id === message.quotedMessageId) || null
}

function handleClaim() {
  if (props.item) {
    emit('claim', props.item)
  }
}

function getContactName() {
  return props.item?.conversation.name || props.item?.conversation.identifier || 'Cliente'
}

function getContactInitial() {
  return getContactName().charAt(0).toUpperCase()
}

function getChannelInfo() {
  const p = props.item?.conversation.provider?.toLowerCase()
  if (p?.includes('whatsapp') || p === 'wpp') {
    return { label: 'WhatsApp', color: 'bg-emerald-500', textColor: 'text-white' }
  }
  if (p?.includes('instagram') || p === 'ig') {
    return { label: 'Instagram', color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400', textColor: 'text-white' }
  }
  if (p?.includes('telegram')) {
    return { label: 'Telegram', color: 'bg-sky-500', textColor: 'text-white' }
  }
  if (p?.includes('facebook') || p === 'fb') {
    return { label: 'Facebook', color: 'bg-blue-600', textColor: 'text-white' }
  }
  return null
}

// Tags management
watch(() => props.item, (newItem) => {
  if (newItem) {
    localTags.value = [...newItem.tags]
    fetchTags()
  }
}, { immediate: true })

async function fetchTags() {
  try {
    const response = await tagsApi.list()
    if (response.data) {
      availableTags.value = response.data
    }
  } catch (error) {
    console.error('Erro ao carregar tags:', error)
  }
}

async function toggleTag(tagName: string) {
  if (!props.item) return

  const index = localTags.value.indexOf(tagName)
  if (index === -1) {
    localTags.value.push(tagName)
  } else {
    localTags.value.splice(index, 1)
  }

  try {
    await queueApi.addTags(props.item.conversation._id, localTags.value)
    emit('tagsUpdated', localTags.value)
    toast.success('Tags atualizadas')
  } catch (error) {
    console.error('Erro ao atualizar tags:', error)
    toast.error('Erro ao atualizar tags')
    // Revert on error
    if (index === -1) {
      localTags.value.pop()
    } else {
      localTags.value.splice(index, 0, tagName)
    }
  }
}

function isTagSelected(tagName: string) {
  return localTags.value.includes(tagName)
}

function getTagColor(tagName: string) {
  const tag = availableTags.value.find(t => t.name === tagName)
  return tag?.color || '#6B7280'
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 bg-black/50 z-50"
        @click="showTagsDropdown = false; emit('close')"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="slide-up">
      <div
        v-if="open && item"
        class="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 flex flex-col"
        style="max-height: 85vh;"
      >
        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div class="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <!-- Header melhorado -->
        <div class="px-4 pb-4 border-b border-gray-100 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- Avatar com indicador de canal -->
              <div class="relative flex-shrink-0">
                <div
                  class="w-14 h-14 rounded-full flex items-center justify-center ring-2 ring-offset-2"
                  :class="getChannelInfo()
                    ? `ring-${getChannelInfo()?.color.includes('emerald') ? 'emerald' : getChannelInfo()?.color.includes('sky') ? 'sky' : 'pink'}-200`
                    : 'ring-gray-200'"
                  :style="!item.conversation.photo ? { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } : {}"
                >
                  <img
                    v-if="item.conversation.photo"
                    :src="item.conversation.photo"
                    :alt="getContactName()"
                    class="w-14 h-14 rounded-full object-cover"
                  />
                  <span v-else class="text-xl font-bold text-white">
                    {{ getContactInitial() }}
                  </span>
                </div>
                <!-- Badge do canal no avatar -->
                <span
                  v-if="getChannelInfo()"
                  class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md"
                  :class="[getChannelInfo()?.color, getChannelInfo()?.textColor]"
                >
                  {{ getChannelInfo()?.label.charAt(0) }}
                </span>
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-gray-900 truncate text-lg">
                    {{ getContactName() }}
                  </h3>
                  <!-- Badge do canal -->
                  <span
                    v-if="getChannelInfo()"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm"
                    :class="[getChannelInfo()?.color, getChannelInfo()?.textColor]"
                  >
                    {{ getChannelInfo()?.label }}
                  </span>
                </div>
                <!-- Tempo de espera e instância -->
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  <div
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="item.waitTime > 300
                      ? 'bg-red-100 text-red-700'
                      : item.waitTime > 120
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'"
                  >
                    <Clock class="w-3 h-3" />
                    Aguardando {{ formatWaitTime(item.waitTime) }}
                  </div>
                  <!-- Instance badge -->
                  <div
                    v-if="item.conversation.instanceName"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700"
                  >
                    <Smartphone class="w-3 h-3" />
                    {{ item.conversation.instanceName }}
                  </div>
                </div>
              </div>
            </div>
            <button
              @click="emit('close')"
              class="p-2.5 hover:bg-gray-100 rounded-xl flex-shrink-0 transition-colors"
            >
              <X class="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <!-- Tags Section -->
          <div class="mt-3 relative">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Existing tags -->
              <span
                v-for="tag in localTags"
                :key="tag"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                :style="{ backgroundColor: getTagColor(tag) }"
              >
                <Tag class="w-3 h-3" />
                {{ tag }}
                <button
                  @click="toggleTag(tag)"
                  class="ml-0.5 hover:opacity-70"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>

              <!-- Add tag button -->
              <button
                @click="showTagsDropdown = !showTagsDropdown"
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-600 transition-colors"
              >
                <Plus class="w-3 h-3" />
                Tag
              </button>
            </div>

            <!-- Tags dropdown -->
            <Transition name="fade">
              <div
                v-if="showTagsDropdown && availableTags.length > 0"
                class="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-48 max-h-48 overflow-y-auto"
              >
                <div class="p-2 space-y-1">
                  <button
                    v-for="tag in availableTags"
                    :key="tag._id"
                    @click="toggleTag(tag.name)"
                    class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <div
                      class="w-3 h-3 rounded-full flex-shrink-0"
                      :style="{ backgroundColor: tag.color }"
                    />
                    <span class="flex-1 text-sm text-gray-700">{{ tag.name }}</span>
                    <Check
                      v-if="isTagSelected(tag.name)"
                      class="w-4 h-4 text-primary-600 flex-shrink-0"
                    />
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>

          <template v-else-if="messages.length > 0">
            <div
              v-for="message in messages"
              :key="message._id"
              class="flex"
              :class="message.type === 'system' ? 'justify-center' : message.direction === 'outgoing' ? 'justify-end' : 'justify-start'"
            >
              <!-- System message -->
              <div
                v-if="message.type === 'system'"
                class="max-w-[80%] px-3 py-1 rounded-full bg-gray-200/80 text-center"
              >
                <p class="text-[10px] text-gray-500 italic">{{ message.message }}</p>
              </div>

              <div
                v-else
                class="max-w-[80%] px-3 py-2 rounded-2xl text-sm"
                :class="message.direction === 'outgoing'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-900'"
              >
                <!-- Quoted/Reply Message -->
                <div
                  v-if="getQuotedMessage(message)"
                  class="mb-2 p-1.5 rounded border-l-2 text-xs"
                  :class="message.direction === 'outgoing'
                    ? 'bg-white/10 border-white/50'
                    : 'bg-gray-100 border-gray-300'"
                >
                  <p class="font-medium opacity-70 mb-0.5">
                    {{ getQuotedMessage(message)?.direction === 'incoming' ? 'Cliente' : 'Operador' }}
                  </p>
                  <p class="line-clamp-2 opacity-80">
                    {{ getMessagePreview(getQuotedMessage(message)!) }}
                  </p>
                </div>

                <!-- Media indicator -->
                <div
                  v-if="message.type !== 'text' && message.type !== 'chat' && message.type !== 'list' && message.type !== 'buttons'"
                  class="flex items-center gap-1.5 mb-1"
                  :class="message.direction === 'outgoing' ? 'opacity-75' : 'text-gray-500'"
                >
                  <component :is="getMessageIcon(message.type)" class="w-3.5 h-3.5" />
                  <span class="text-xs">{{ message.type === 'ptt' ? 'audio' : message.type }}</span>
                </div>

                <!-- Image preview -->
                <img
                  v-if="message.type === 'image' && message.mediaUrl"
                  :src="message.mediaUrl"
                  class="max-w-full h-auto rounded-lg mb-1"
                  style="max-height: 150px; object-fit: cover;"
                />

                <!-- List message -->
                <div v-if="message.type === 'list'" class="mb-0.5">
                  <template v-if="(message as any).metadata?.sections">
                    <p v-if="(message as any).metadata.title" class="text-xs font-semibold mb-0.5">{{ (message as any).metadata.title }}</p>
                    <p v-if="(message as any).metadata.description" class="text-[10px] opacity-80 mb-1.5">{{ (message as any).metadata.description }}</p>
                    <div v-for="section in ((message as any).metadata.sections as any[])" :key="section.title" class="space-y-0.5 mb-1">
                      <p v-if="section.title" class="text-[10px] font-semibold uppercase opacity-50">{{ section.title }}</p>
                      <div v-for="(row, rowIndex) in section.rows" :key="row.rowId"
                        class="px-2 py-1 text-[11px] rounded border"
                        :class="message.direction === 'outgoing' ? 'border-white/20 bg-white/10' : 'border-black/10 bg-black/5'"
                      >
                        <span class="font-semibold opacity-60">{{ rowIndex + 1 }}.</span> {{ row.title }}
                      </div>
                    </div>
                  </template>
                  <p v-else-if="message.message" class="whitespace-pre-wrap break-words">{{ message.message }}</p>
                  <p v-else class="text-xs opacity-50 italic">Mensagem de lista</p>
                </div>

                <!-- Buttons message -->
                <div v-else-if="message.type === 'buttons'" class="mb-0.5">
                  <template v-if="(message as any).metadata?.buttons">
                    <p v-if="(message as any).metadata.title" class="text-xs font-semibold mb-0.5">{{ (message as any).metadata.title }}</p>
                    <p v-if="(message as any).metadata.description" class="text-[10px] opacity-80 mb-1.5">{{ (message as any).metadata.description }}</p>
                    <div class="flex flex-col gap-0.5">
                      <div v-for="btn in ((message as any).metadata.buttons as any[])" :key="btn.id"
                        class="px-2 py-1 text-[11px] rounded border text-center"
                        :class="message.direction === 'outgoing' ? 'border-white/20 bg-white/10' : 'border-black/10 bg-black/5'"
                      >
                        {{ btn.text }}
                      </div>
                    </div>
                  </template>
                  <p v-else-if="message.message" class="whitespace-pre-wrap break-words">{{ message.message }}</p>
                  <p v-else class="text-xs opacity-50 italic">Mensagem de botões</p>
                </div>

                <!-- Message text -->
                <p v-else class="whitespace-pre-wrap break-words">{{ getMessagePreview(message) }}</p>
                <p
                  class="text-[10px] mt-1 text-right"
                  :class="message.direction === 'outgoing' ? 'opacity-60' : 'text-gray-400'"
                >
                  {{ formatTime(message.createdAt) }}
                </p>
              </div>
            </div>
          </template>

          <div v-else class="text-center py-8 text-gray-500">
            <MessageSquare class="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p class="text-sm">Nenhuma mensagem ainda</p>
          </div>
        </div>

        <!-- Footer with action -->
        <div class="p-4 border-t border-gray-100 bg-white flex-shrink-0 safe-area-bottom">
          <button
            @click="handleClaim"
            class="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 text-white font-semibold text-lg shadow-lg shadow-primary-500/30 active:scale-[0.98] transition-all"
          >
            <MessageSquare class="w-6 h-6" />
            Assumir Atendimento
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

.safe-area-bottom {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
</style>
