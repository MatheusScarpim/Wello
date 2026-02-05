<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart, registerables, type ChartConfiguration } from 'chart.js'

Chart.register(...registerables)

interface BarChartData {
  label: string
  value: number
  color?: string
}

const props = withDefaults(defineProps<{
  data: BarChartData[]
  title?: string
  horizontal?: boolean
  gradient?: boolean
}>(), {
  horizontal: false,
  gradient: true
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const defaultColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
]

function buildConfig(): ChartConfiguration<'bar'> {
  const colors = props.data.map((d, i) => d.color || defaultColors[i % defaultColors.length])

  return {
    type: 'bar',
    data: {
      labels: props.data.map(d => d.label),
      datasets: [{
        data: props.data.map(d => d.value),
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: props.horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
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
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: { font: { size: 11 } }
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
  <div class="h-72 w-full">
    <canvas ref="canvasRef" />
  </div>
</template>
