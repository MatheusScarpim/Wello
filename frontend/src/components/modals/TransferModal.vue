<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import { departmentsApi, operatorsApi } from '@/api'
import { useOperatorStore } from '@/stores/operator'
import type { Department, Operator } from '@/types'

const props = defineProps<{
  modelValue: boolean
  conversationId: string
  currentOperatorId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  transferred: []
}>()

const toast = useToast()
const operatorStore = useOperatorStore()

const transferType = ref<'department' | 'operator'>('department')
const targetId = ref('')
const notes = ref('')
const isLoading = ref(false)

const departments = ref<Department[]>([])
const operators = ref<Operator[]>([])

async function fetchOptions() {
  try {
    const [deptRes, opRes] = await Promise.all([
      departmentsApi.list(),
      operatorsApi.list()
    ])
    if (deptRes.data) departments.value = deptRes.data as Department[]
    if (opRes.data) operators.value = opRes.data as Operator[]
  } catch {
    toast.error('Erro ao carregar opções')
  }
}

function close() {
  emit('update:modelValue', false)
}

function reset() {
  transferType.value = 'department'
  targetId.value = ''
  notes.value = ''
}

async function handleTransfer() {
  if (!targetId.value) {
    toast.error('Selecione um destino')
    return
  }

  isLoading.value = true
  try {
    await operatorStore.transferConversation(
      props.conversationId,
      transferType.value,
      targetId.value,
      notes.value || undefined
    )
    toast.success('Conversa transferida com sucesso')
    close()
    emit('transferred')
  } catch {
    toast.error('Erro ao transferir conversa')
  } finally {
    isLoading.value = false
  }
}

const availableOperators = () => {
  return operators.value.filter(
    op => op.status === 'online' && op._id !== props.currentOperatorId
  )
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    reset()
    fetchOptions()
  }
})

onMounted(() => {
  if (props.modelValue) {
    fetchOptions()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      @click.self="close"
    >
      <div class="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md sm:m-4 max-h-[90vh] overflow-y-auto">
        <div class="p-4 sm:p-6">
          <!-- Mobile drag handle -->
          <div class="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Transferir Conversa</h2>
            <button
              @click="close"
              class="p-2 rounded-lg hover:bg-gray-100 hidden sm:block"
            >
              <X class="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Transfer type toggle -->
            <div>
              <label class="label">Transferir para</label>
              <div class="flex gap-2">
                <button
                  @click="transferType = 'department'; targetId = ''"
                  class="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                  :class="transferType === 'department' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'"
                >
                  Departamento
                </button>
                <button
                  @click="transferType = 'operator'; targetId = ''"
                  class="flex-1 py-3 rounded-xl text-sm font-medium transition-colors"
                  :class="transferType === 'operator' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'"
                >
                  Operador
                </button>
              </div>
            </div>

            <!-- Target selection -->
            <div>
              <label class="label">{{ transferType === 'department' ? 'Departamento' : 'Operador' }}</label>
              <select v-model="targetId" class="select">
                <option value="">Selecione...</option>
                <template v-if="transferType === 'department'">
                  <option v-for="dept in departments" :key="dept._id" :value="dept._id">
                    {{ dept.name }}
                  </option>
                </template>
                <template v-else>
                  <option v-for="op in availableOperators()" :key="op._id" :value="op._id">
                    {{ op.name }}
                  </option>
                </template>
              </select>
              <p v-if="transferType === 'operator' && availableOperators().length === 0" class="text-sm text-gray-500 mt-1">
                Nenhum operador online disponível
              </p>
            </div>

            <!-- Notes -->
            <div>
              <label class="label">Notas (opcional)</label>
              <textarea
                v-model="notes"
                class="textarea"
                rows="2"
                placeholder="Motivo da transferência..."
              />
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button @click="close" class="btn-secondary flex-1" :disabled="isLoading">
                Cancelar
              </button>
              <button
                @click="handleTransfer"
                class="btn-primary flex-1"
                :disabled="isLoading || !targetId"
              >
                {{ isLoading ? 'Transferindo...' : 'Transferir' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
