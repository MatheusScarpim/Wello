<script setup lang="ts">
import { ref, watch, markRaw, onMounted, onUnmounted, nextTick } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { useBotBuilderStore } from '@/stores/botBuilder'
import { NODE_TYPES } from '@/types/botBuilder'
import type { VisualNodeType } from '@/types/botBuilder'

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

const { project, getSelectedEdges, fitView } = useVueFlow()

// Undo history
type Snapshot = { nodes: string; edges: string }
const history = ref<Snapshot[]>([])
const MAX_HISTORY = 30

function saveSnapshot() {
  history.value.push({
    nodes: JSON.stringify(store.nodes),
    edges: JSON.stringify(store.edges),
  })
  if (history.value.length > MAX_HISTORY) {
    history.value.shift()
  }
}

function undo() {
  const snapshot = history.value.pop()
  if (!snapshot) return
  store.nodes = JSON.parse(snapshot.nodes)
  store.edges = JSON.parse(snapshot.edges)
  store.selectNode(null)
  store.markDirty()
}

let nodeCounter = ref(0)

function generateNodeId(): string {
  nodeCounter.value++
  return `node_${Date.now()}_${nodeCounter.value}`
}

function onNodeClick({ node }: { node: any }) {
  store.selectNode(node.id)
}

function onPaneClick() {
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
  // Ctrl+Z = undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    undo()
    return
  }

  if (e.key !== 'Delete') return

  // Deletar nó selecionado
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
      fit-view-on-init
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
      @connect="onConnect"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
    >
      <Background :gap="15" />
      <Controls />
      <MiniMap />
    </VueFlow>
    <BotBuilderAiAssistant />
  </div>
</template>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';
</style>
