<template>
  <InfoCard class="custom-card">
    <template #title> Execution Frequency </template>
    <template #info>
      <div>
        <apexchart
          type="pie"
          :options="chartOptions"
          :series="series"
          width="600"
          :key="chartKey"
        ></apexchart>
      </div>
    </template>
  </InfoCard>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import InfoCard from './InfoCard.vue';

interface FrequencyValue {
  id?: string;
  name?: string;
  processingGraph?: string;
  [key: string]: unknown;
}

const props = defineProps<{ values: FrequencyValue[] }>();

const series = ref<number[]>([]);
const chartOptions = ref({
  chart: {
    type: 'pie',
    height: 350,
  },
  labels: [] as string[],
  colors: [] as string[],
  legend: {
    show: false,
  },
  tooltip: {
    y: {
      formatter: (val: number) => val + ' executions',
    },
  },
  dataLabels: {
    enabled: true,
    formatter: (val: number, opts: any) => {
      if (val < 5) {
        return '';
      }
      return opts.w.globals.labels[opts.seriesIndex];
    },
    background: {
      enabled: true,
      foreColor: '#fff',
      padding: 4,
      opacity: 0.7,
      borderColor: '#fff',
    },
    style: {
      colors: ['rgb(200,200,200)'],
      fontSize: '14px',
    },
  },
});

const chartKey = computed(() => {
  return JSON.stringify(props.values?.map((v) => v?.id || v?.name || v));
});

function updateChart(values: FrequencyValue[]) {
  const groupedData: Record<
    string,
    { service: string; name: string; count: number }
  > = {};
  values.forEach((value) => {
    const service = (value.processingGraph as string) || '';
    const name = (value.name as string) || 'Unnamed';
    const key = `${service} ${name}`;
    if (!groupedData[key]) {
      groupedData[key] = { service, name, count: 0 };
    }
    groupedData[key].count++;
  });

  const sortedData = Object.values(groupedData).sort((a, b) =>
    a.service.localeCompare(b.service)
  );
  const labels: string[] = [];
  const data: number[] = [];
  const colors: string[] = [];
  const predefinedColors = [
    '#6b8fd4',
    '#85c4a8',
    '#9b85c4',
    '#d49575',
    '#c4a875',
    '#7ba8d4',
    '#d4b895',
    '#b895d4',
    '#a8d4b5',
    '#e8a575',
    '#5a7bc4',
    '#c4b885',
    '#8575c4',
    '#95c4a8',
    '#d4a575',
    '#95b5e8',
    '#e8d4b5',
    '#d4b5e8',
    '#b5e8d4',
    '#f4c485',
  ];
  let colorIndex = 0;
  const colorMap: Record<string, string> = {};

  sortedData.forEach((item) => {
    labels.push(`${item.service}  ${item.name}`);
    data.push(item.count);
    const colorKey = item.service || `${item.name}-${colorIndex}`;
    if (!colorMap[colorKey]) {
      colorMap[colorKey] =
        predefinedColors[colorIndex % predefinedColors.length];
      colorIndex++;
    }
    colors.push(colorMap[colorKey]);
  });

  chartOptions.value.labels = labels;
  chartOptions.value.colors = colors;
  series.value = data;
}

function resetChart() {
  chartOptions.value.labels = [];
  chartOptions.value.colors = [];
  series.value = [];
}

watch(
  () => props.values,
  (newValues) => {
    if (newValues && newValues.length) {
      updateChart(newValues);
    } else {
      resetChart();
    }
  },
  { immediate: true, deep: true }
);
</script>

<style scoped>
.custom-card {
  border-radius: 20px !important;
  min-width: 25dvw !important;
  height: 60dvh !important;
}
</style>
