<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart, registerables, type ChartConfiguration } from 'chart.js'

Chart.register(...registerables)

interface DoughnutChartData {
  label: string
  value: number
  color: string
}

const props = withDefaults(defineProps<{
  data: DoughnutChartData[]
  title?: string
  centerText?: string
  centerSubtext?: string
}>(), {
  centerText: '',
  centerSubtext: ''
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

function buildConfig(): ChartConfiguration {
  return {
    type: 'doughnut',
    data: {
      labels: props.data.map(d => d.label),
      datasets: [{
        data: props.data.map(d => d.value),
        backgroundColor: props.data.map(d => d.color),
        borderColor: '#ffffff',
        borderWidth: 4,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 12, weight: '500' }
          }
        },
        title: {
          display: Boolean(props.title),
          text: props.title ?? '',
          font: { size: 16, weight: '600' },
          padding: { bottom: 16 }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          titleFont: { size: 13, weight: '600' },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const total = context.dataset.data.reduce((a, b) => (a as number) + (b as number), 0) as number
              const value = context.raw as number
              const percentage = ((value / total) * 100).toFixed(1)
              return ` ${context.label}: ${value} (${percentage}%)`
            }
          }
        }
      }
    }
  }
}

function renderChart() {
  if (!canvasRef.value) return
  const context = canvasRef.value.getContext('2d')
  if (!context) return

  chartInstance?.destroy()
  chartInstance = new Chart(context, buildConfig())
}

onMounted(renderChart)

watch(() => props.data, () => renderChart(), { deep: true })

onBeforeUnmount(() => {
  chartInstance?.destroy()
})
</script>

<template>
  <div class="relative h-72 w-full">
    <canvas ref="canvasRef" />
    <!-- Center text overlay -->
    <div
      v-if="centerText"
      class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      style="top: -20px;"
    >
      <span class="text-3xl font-bold text-gray-900">{{ centerText }}</span>
      <span v-if="centerSubtext" class="text-sm text-gray-500">{{ centerSubtext }}</span>
    </div>
  </div>
</template>
