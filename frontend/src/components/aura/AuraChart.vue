<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart, registerables, type ChartConfiguration } from 'chart.js'
import type { AuraChart } from '@/types/aura'

Chart.register(...registerables)

const props = defineProps<{
  chart: AuraChart
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const palette = ['#2563eb', '#16a34a', '#f97316', '#e11d48', '#14b8a6', '#64748b']

function getKeys(data: Record<string, unknown>[]) {
  const firstRow = data[0]
  if (!firstRow) return { xKey: undefined, yKey: undefined }
  const keys = Object.keys(firstRow)
  return { xKey: keys[0], yKey: keys[1] }
}

function normalizeType(type?: AuraChart['type']) {
  if (type === 'area') return 'line'
  return type ?? 'bar'
}

function buildConfig(): ChartConfiguration {
  const dataRows = props.chart.data ?? []
  const fallbackKeys = getKeys(dataRows)
  const xKey = props.chart.xKey ?? fallbackKeys.xKey
  const yKey = props.chart.yKey ?? fallbackKeys.yKey

  const labels = xKey
    ? dataRows.map((row) => String(row[xKey] ?? ''))
    : dataRows.map((_, index) => String(index + 1))

  const values = yKey
    ? dataRows.map((row) => Number(row[yKey] ?? 0))
    : dataRows.map(() => 0)

  const type = normalizeType(props.chart.type)
  const isArea = props.chart.type === 'area'
  const colors = values.map((_, index) => palette[index % palette.length])
  const datasetColor = palette[0]

  return {
    type,
    data: {
      labels,
      datasets: [
        {
          label: yKey ?? 'Value',
          data: values,
          borderWidth: 2,
          backgroundColor: type === 'doughnut' ? colors : datasetColor,
          borderColor: type === 'doughnut' ? colors : datasetColor,
          fill: isArea,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: type === 'doughnut',
          position: 'bottom',
        },
        title: {
          display: Boolean(props.chart.title),
          text: props.chart.title ?? '',
        },
      },
      scales: type === 'doughnut'
        ? {}
        : {
            x: {
              ticks: {
                maxRotation: 30,
                minRotation: 0,
              },
            },
            y: {
              beginAtZero: true,
            },
          },
    },
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

watch(
  () => props.chart,
  () => renderChart(),
  { deep: true }
)

onBeforeUnmount(() => {
  chartInstance?.destroy()
})
</script>

<template>
  <div class="h-64 w-full">
    <canvas ref="canvasRef" />
  </div>
</template>
