<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { expensesApi } from '@/api'
import { X } from 'lucide-vue-next'
import { useToast } from 'vue-toastification'
import type { Expense } from '@/types'

const props = defineProps<{
  expense: Expense | null
  clients: string[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const isLoading = ref(false)

const form = ref({
  obra: '',
  cliente: '',
  documentoVinculado: '',
  dataVencimento: '',
  descricao: '',
  tipoDespesa: '',
  centroCusto: '',
  valor: 0,
  semNotaEmitida: false,
  dependeFechamentoLoja: false
})

const isEditing = computed(() => !!props.expense)

const tiposDespesa = [
  'Compra',
  'Serviço',
  'Aluguel',
  'Transporte',
  'Alimentação',
  'Material',
  'Mão de Obra',
  'Outros'
]

onMounted(() => {
  if (props.expense) {
    form.value = {
      obra: props.expense.obra,
      cliente: props.expense.cliente,
      documentoVinculado: props.expense.documentoVinculado || '',
      dataVencimento: props.expense.dataVencimento?.split('T')[0] || '',
      descricao: props.expense.descricao,
      tipoDespesa: props.expense.tipoDespesa,
      centroCusto: props.expense.centroCusto || '',
      valor: props.expense.valor,
      semNotaEmitida: props.expense.semNotaEmitida || false,
      dependeFechamentoLoja: props.expense.dependeFechamentoLoja || false
    }
  }
})

async function handleSubmit() {
  if (!form.value.descricao || !form.value.cliente || !form.value.valor) {
    toast.error('Preencha os campos obrigatórios')
    return
  }

  isLoading.value = true
  try {
    const payload = {
      ...form.value,
      valor: Number(form.value.valor),
      dataVencimento: form.value.dataVencimento || undefined,
      documentoVinculado: form.value.documentoVinculado || undefined,
      centroCusto: form.value.centroCusto || undefined
    }

    if (isEditing.value && props.expense) {
      await expensesApi.update(props.expense._id, payload)
      toast.success('Despesa atualizada')
    } else {
      await expensesApi.create(payload)
      toast.success('Despesa criada')
    }

    emit('saved')
    emit('close')
  } catch {
    toast.error('Erro ao salvar despesa')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">
            {{ isEditing ? 'Editar Despesa' : 'Nova Despesa' }}
          </h2>
          <button @click="emit('close')" class="p-2 rounded-lg hover:bg-gray-100">
            <X class="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label class="label">Descrição *</label>
            <input
              v-model="form.descricao"
              type="text"
              class="input"
              placeholder="Descrição da despesa"
              required
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Cliente *</label>
              <input
                v-model="form.cliente"
                type="text"
                class="input"
                placeholder="Nome do cliente"
                list="clients-list"
                required
              />
              <datalist id="clients-list">
                <option v-for="client in clients" :key="client" :value="client" />
              </datalist>
            </div>

            <div>
              <label class="label">Obra *</label>
              <input
                v-model="form.obra"
                type="text"
                class="input"
                placeholder="Nome da obra"
                required
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Tipo de Despesa *</label>
              <select v-model="form.tipoDespesa" class="select" required>
                <option value="">Selecione...</option>
                <option v-for="tipo in tiposDespesa" :key="tipo" :value="tipo">
                  {{ tipo }}
                </option>
              </select>
            </div>

            <div>
              <label class="label">Valor (R$) *</label>
              <input
                v-model.number="form.valor"
                type="number"
                step="0.01"
                min="0"
                class="input"
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">Data de Vencimento</label>
              <input
                v-model="form.dataVencimento"
                type="date"
                class="input"
              />
            </div>

            <div>
              <label class="label">Centro de Custo</label>
              <input
                v-model="form.centroCusto"
                type="text"
                class="input"
                placeholder="CC001"
              />
            </div>
          </div>

          <div>
            <label class="label">Documento Vinculado</label>
            <input
              v-model="form.documentoVinculado"
              type="text"
              class="input"
              placeholder="NF123456"
            />
          </div>

          <div class="space-y-2">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                v-model="form.semNotaEmitida"
                class="w-4 h-4 text-primary-600 rounded"
              />
              <span class="text-sm text-gray-700">Sem nota emitida</span>
            </label>

            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                v-model="form.dependeFechamentoLoja"
                class="w-4 h-4 text-primary-600 rounded"
              />
              <span class="text-sm text-gray-700">Depende fechamento loja</span>
            </label>
          </div>
        </form>

        <!-- Footer -->
        <div class="flex gap-3 p-4 border-t border-gray-200">
          <button type="button" @click="emit('close')" class="btn-secondary flex-1">
            Cancelar
          </button>
          <button @click="handleSubmit" :disabled="isLoading" class="btn-primary flex-1">
            {{ isLoading ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
