import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import { visualBotsApi } from '@/api'
import type { VisualBotDefinition } from '@/types/botBuilder'

export const useBotBuilderStore = defineStore('botBuilder', () => {
  // Metadata
  const definitionId = ref<string | null>(null)
  const botId = ref('')
  const botName = ref('')
  const botDescription = ref('')
  const botStatus = ref<'draft' | 'published' | 'archived'>('draft')

  // Vue Flow state
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])

  // UI state
  const selectedNodeId = ref<string | null>(null)
  const isDirty = ref(false)
  const isSaving = ref(false)
  const isLoading = ref(false)
  const showTestPanel = ref(false)

  // Viewport
  const viewport = ref<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 1,
  })

  const selectedNode = computed(() =>
    nodes.value.find((n) => n.id === selectedNodeId.value) || null,
  )

  // ============================================
  // Actions
  // ============================================

  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId
  }

  function updateNodeData(nodeId: string, data: any) {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (node) {
      node.data = { ...node.data, ...data }
      isDirty.value = true
    }
  }

  function updateNodeLabel(nodeId: string, label: string) {
    const node = nodes.value.find((n) => n.id === nodeId)
    if (node) {
      node.data = { ...node.data, label }
      isDirty.value = true
    }
  }

  function removeNode(nodeId: string) {
    nodes.value = nodes.value.filter((n) => n.id !== nodeId)
    edges.value = edges.value.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    )
    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null
    }
    isDirty.value = true
  }

  function markDirty() {
    isDirty.value = true
  }

  async function save() {
    if (!definitionId.value) return

    isSaving.value = true
    try {
      // Converter nodes do Vue Flow para o formato de storage
      const storageNodes = nodes.value.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        label: n.data?.label || n.label,
      }))

      const storageEdges = edges.value.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        label: e.label,
        animated: e.animated,
      }))

      await visualBotsApi.update(definitionId.value, {
        name: botName.value,
        description: botDescription.value,
        nodes: storageNodes,
        edges: storageEdges,
        viewport: viewport.value,
      })

      isDirty.value = false
    } finally {
      isSaving.value = false
    }
  }

  async function publish() {
    if (!definitionId.value) return

    // Salvar antes de publicar
    await save()

    await visualBotsApi.publish(definitionId.value)
    botStatus.value = 'published'
  }

  async function unpublish() {
    if (!definitionId.value) return

    await visualBotsApi.unpublish(definitionId.value)
    botStatus.value = 'draft'
  }

  async function loadDefinition(id: string) {
    isLoading.value = true
    try {
      const response = await visualBotsApi.getById(id)
      const def: VisualBotDefinition = response.data

      definitionId.value = def._id || id
      botId.value = def.botId
      botName.value = def.name
      botDescription.value = def.description || ''
      botStatus.value = def.status

      // Converter nodes do storage para Vue Flow
      nodes.value = (def.nodes || []).map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { ...n.data, label: n.label },
        label: n.label,
      }))

      edges.value = (def.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        label: e.label,
        animated: e.animated,
      }))

      if (def.viewport) {
        viewport.value = def.viewport
      }

      isDirty.value = false
    } finally {
      isLoading.value = false
    }
  }

  function reset() {
    definitionId.value = null
    botId.value = ''
    botName.value = ''
    botDescription.value = ''
    botStatus.value = 'draft'
    nodes.value = []
    edges.value = []
    selectedNodeId.value = null
    isDirty.value = false
    isSaving.value = false
    isLoading.value = false
    showTestPanel.value = false
    viewport.value = { x: 0, y: 0, zoom: 1 }
  }

  return {
    // State
    definitionId,
    botId,
    botName,
    botDescription,
    botStatus,
    nodes,
    edges,
    selectedNodeId,
    selectedNode,
    isDirty,
    isSaving,
    isLoading,
    showTestPanel,
    viewport,

    // Actions
    selectNode,
    updateNodeData,
    updateNodeLabel,
    removeNode,
    markDirty,
    save,
    publish,
    unpublish,
    loadDefinition,
    reset,
  }
})
