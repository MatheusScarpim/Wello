<script setup lang="ts">
import { ref, watch, markRaw, onMounted, onUnmounted, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { NODE_TYPES } from '@/types/botBuilder'
import type { VisualNodeType } from '@/types/botBuilder'
import { HelpCircle, X } from 'lucide-vue-next'

import StartNode from './nodes/StartNode.vue'
import SendMessageNode from './nodes/SendMessageNode.vue'
import AskQuestionNode from './nodes/AskQuestionNode.vue'
import ButtonsNode from './nodes/ButtonsNode.vue'
import ListNode from './nodes/ListNode.vue'
import ConditionNode from './nodes/ConditionNode.vue'
import SetVariableNode from './nodes/SetVariableNode.vue'
import HttpRequestNode from './nodes/HttpRequestNode.vue'
import DelayNode from './nodes/DelayNode.vue'
import AiResponseNode from './nodes/AiResponseNode.vue'
import AppointmentSchedulingNode from './nodes/AppointmentSchedulingNode.vue'
import EndNode from './nodes/EndNode.vue'
import BotBuilderAiAssistant from './BotBuilderAiAssistant.vue'

const store = useBotBuilderStore()

const nodeTypes = {
  start: markRaw(StartNode),
  send_message: markRaw(SendMessageNode),
  ask_question: markRaw(AskQuestionNode),
  buttons: markRaw(ButtonsNode),
  list: markRaw(ListNode),
  condition: markRaw(ConditionNode),
  set_variable: markRaw(SetVariableNode),
  http_request: markRaw(HttpRequestNode),
  delay: markRaw(DelayNode),
  ai_response: markRaw(AiResponseNode),
  appointment_scheduling: markRaw(AppointmentSchedulingNode),
  end: markRaw(EndNode),
}

const { project, getSelectedNodes, getSelectedEdges, fitView } = useVueFlow()

const showHelp = ref(false)

// Undo / Redo history
type Snapshot = { nodes: string; edges: string }
const undoHistory = ref<Snapshot[]>([])
const redoHistory = ref<Snapshot[]>([])
const MAX_HISTORY = 30

function saveSnapshot() {
  undoHistory.value.push({
    nodes: JSON.stringify(store.nodes),
    edges: JSON.stringify(store.edges),
  })
  if (undoHistory.value.length > MAX_HISTORY) {
    undoHistory.value.shift()
  }
  // Nova ação limpa o redo
  redoHistory.value = []
}

function undo() {
  const snapshot = undoHistory.value.pop()
  if (!snapshot) return
  // Salvar estado atual no redo antes de desfazer
  redoHistory.value.push({
    nodes: JSON.stringify(store.nodes),
    edges: JSON.stringify(store.edges),
  })
  store.nodes = JSON.parse(snapshot.nodes)
  store.edges = JSON.parse(snapshot.edges)
  store.selectNode(null)
  store.markDirty()
}

function redo() {
  const snapshot = redoHistory.value.pop()
  if (!snapshot) return
  // Salvar estado atual no undo antes de refazer
  undoHistory.value.push({
    nodes: JSON.stringify(store.nodes),
    edges: JSON.stringify(store.edges),
  })
  store.nodes = JSON.parse(snapshot.nodes)
  store.edges = JSON.parse(snapshot.edges)
  store.selectNode(null)
  store.markDirty()
}

// Clipboard para copiar/colar nós
const clipboard = ref<{ nodes: any[]; edges: any[] } | null>(null)

function copySelectedNodes() {
  const selected = getSelectedNodes.value
  // Se não tem multi-seleção, tenta o nó do painel
  const nodesToCopy = selected.length > 0
    ? selected
    : store.selectedNode ? [store.selectedNode] : []

  if (nodesToCopy.length === 0) return

  // Não copiar nó start
  const filtered = nodesToCopy.filter((n) => n.type !== 'start')
  if (filtered.length === 0) return

  const nodeIds = new Set(filtered.map((n) => n.id))

  // Copiar edges entre os nós copiados
  const edgesToCopy = store.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  )

  clipboard.value = {
    nodes: JSON.parse(JSON.stringify(filtered.map((n) => ({
      type: n.type,
      position: n.position,
      data: n.data,
    })))),
    edges: JSON.parse(JSON.stringify(edgesToCopy.map((e) => ({
      sourceIndex: filtered.findIndex((n) => n.id === e.source),
      targetIndex: filtered.findIndex((n) => n.id === e.target),
      sourceHandle: e.sourceHandle,
      animated: e.animated,
    })))),
  }
}

function pasteNodes() {
  if (!clipboard.value || clipboard.value.nodes.length === 0) return

  saveSnapshot()

  const OFFSET = 50
  const newNodeIds: string[] = []

  // Criar novos nós com offset de posição
  for (const nodeCopy of clipboard.value.nodes) {
    const newId = generateNodeId()
    newNodeIds.push(newId)
    store.nodes.push({
      id: newId,
      type: nodeCopy.type,
      position: {
        x: nodeCopy.position.x + OFFSET,
        y: nodeCopy.position.y + OFFSET,
      },
      data: JSON.parse(JSON.stringify(nodeCopy.data)),
    })
  }

  // Recriar edges entre os nós colados
  for (const edgeCopy of clipboard.value.edges) {
    if (edgeCopy.sourceIndex < 0 || edgeCopy.targetIndex < 0) continue
    const sourceId = newNodeIds[edgeCopy.sourceIndex]
    const targetId = newNodeIds[edgeCopy.targetIndex]
    const edgeId = `edge_${sourceId}_${edgeCopy.sourceHandle || 'default'}_${targetId}`
    store.edges.push({
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: edgeCopy.sourceHandle,
      animated: edgeCopy.animated ?? true,
    })
  }

  // Atualizar posições no clipboard pra próximo paste ter offset acumulado
  clipboard.value.nodes = clipboard.value.nodes.map((n) => ({
    ...n,
    position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
  }))

  store.markDirty()
}

let nodeCounter = ref(0)

function generateNodeId(): string {
  nodeCounter.value++
  return `node_${Date.now()}_${nodeCounter.value}`
}

function onNodeClick({ node, event }: { node: any; event: MouseEvent }) {
  // Se está segurando Shift, não abre o painel de config (multi-seleção)
  if (event.shiftKey) return
  store.selectNode(node.id)
}

function onPaneClick() {
  store.selectNode(null)
}

function onSelectionEnd() {
  // Multi-seleção por área: não abre painel de config
  store.selectNode(null)
}

function onConnect(params: any) {
  const edgeId = `edge_${params.source}_${params.sourceHandle || 'default'}_${params.target}`
  const exists = store.edges.some((e) => e.id === edgeId)
  if (!exists) {
    saveSnapshot()
    store.edges.push({
      id: edgeId,
      source: params.source,
      target: params.target,
      sourceHandle: params.sourceHandle || undefined,
      animated: true,
    })
    store.markDirty()
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent) {
  if (!event.dataTransfer) return

  const nodeType = event.dataTransfer.getData('application/vueflow') as VisualNodeType
  if (!nodeType) return

  const nodeInfo = NODE_TYPES.find((n) => n.type === nodeType)
  if (!nodeInfo) return

  // Verificar se já existe um nó Start
  if (nodeType === 'start' && store.nodes.some((n) => n.type === 'start')) {
    return
  }

  const position = project({
    x: event.clientX,
    y: event.clientY,
  })

  const newNode = {
    id: generateNodeId(),
    type: nodeType,
    position,
    data: {
      ...JSON.parse(JSON.stringify(nodeInfo.defaultData)),
      label: nodeInfo.label,
    },
  }

  saveSnapshot()
  store.nodes.push(newNode)
  store.markDirty()
}

function onNodesChange() {
  store.markDirty()
}

function onEdgesChange() {
  store.markDirty()
}

function onKeydown(e: KeyboardEvent) {
  // Esc = fechar ajuda
  if (e.key === 'Escape' && showHelp.value) {
    showHelp.value = false
    return
  }

  // Ctrl+Z = undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undo()
    return
  }

  // Ctrl+Y = redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    redo()
    return
  }

  // Ctrl+C = copiar
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    copySelectedNodes()
    return
  }

  // Ctrl+V = colar
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault()
    pasteNodes()
    return
  }

  if (e.key !== 'Delete') return

  // Deletar nós selecionados (multi-seleção)
  const selectedNodes = getSelectedNodes.value.filter((n) => n.type !== 'start')
  if (selectedNodes.length > 0) {
    saveSnapshot()
    for (const node of selectedNodes) {
      store.removeNode(node.id)
    }
    return
  }

  // Deletar nó selecionado no painel (single)
  if (store.selectedNodeId) {
    const node = store.nodes.find((n) => n.id === store.selectedNodeId)
    if (node && node.type !== 'start') {
      saveSnapshot()
      store.removeNode(store.selectedNodeId)
    }
    return
  }

  // Deletar edges selecionadas
  const selectedEdges = getSelectedEdges.value
  if (selectedEdges.length > 0) {
    saveSnapshot()
    const selectedIds = new Set(selectedEdges.map((e) => e.id))
    store.edges = store.edges.filter((e) => !selectedIds.has(e.id))
    store.markDirty()
  }
}

watch(() => store.fitViewTrigger, () => {
  nextTick(() => {
    fitView({ padding: 0.2, duration: 300 })
  })
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="flex-1 h-full relative" @drop="onDrop" @dragover="onDragOver">
    <VueFlow
      v-model:nodes="store.nodes"
      v-model:edges="store.edges"
      :node-types="nodeTypes"
      :default-viewport="store.viewport"
      :min-zoom="0.2"
      :max-zoom="2"
      :snap-to-grid="true"
      :snap-grid="[15, 15]"
      :selection-key-code="'Shift'"
      :multi-selection-key-code="'Shift'"
      fit-view-on-init
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @connect="onConnect"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @selection-end="onSelectionEnd"
    >
      <Background :gap="15" />
      <Controls />
      <MiniMap />
    </VueFlow>
    <BotBuilderAiAssistant />

    <!-- Botão de ajuda -->
    <button
      type="button"
      class="absolute top-4 right-4 z-10 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors"
      title="Atalhos do teclado"
      @click="showHelp = true"
    >
      <HelpCircle class="w-5 h-5" />
    </button>

    <!-- Modal de ajuda -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showHelp"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          @click.self="showHelp = false"
        >
          <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 class="text-lg font-semibold text-gray-900">Atalhos e comandos</h3>
              <button
                type="button"
                class="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                @click="showHelp = false"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Conteúdo -->
            <div class="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <!-- Navegação -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Navegação</h4>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Mover canvas</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Click + Arrastar</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Zoom</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Scroll</kbd>
                  </div>
                </div>
              </div>

              <!-- Seleção -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Seleção</h4>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Selecionar nó</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Click</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Selecionar vários</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Shift + Click</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Seleção por área</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Shift + Arrastar</kbd>
                  </div>
                </div>
              </div>

              <!-- Edição -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Edição</h4>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Deletar selecionado</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Delete</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Desfazer</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Ctrl + Z</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Refazer</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Ctrl + Y</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Copiar</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Ctrl + C</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Colar</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Ctrl + V</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Conectar nós</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Arrastar handle</kbd>
                  </div>
                </div>
              </div>

              <!-- Nós -->
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nós</h4>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Adicionar nó</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Arrastar da paleta</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Mover nó</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Click + Arrastar</kbd>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-600">Mover vários nós</span>
                    <kbd class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono">Selecionar + Arrastar</kbd>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-gray-100 bg-gray-50">
              <p class="text-xs text-gray-400 text-center">Pressione <kbd class="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono">Esc</kbd> para fechar</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';

.vue-flow__node.selected {
  box-shadow: 0 0 0 2px #6366f1, 0 4px 12px rgba(99, 102, 241, 0.3);
  border-radius: 11px;
}

.vue-flow__selection {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 4px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
