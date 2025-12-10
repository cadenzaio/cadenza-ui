<template>
  <InfoCard>
    <template #title> Service Statistics </template>
    <template #info>
      <div v-if="hasData">
        <apexchart
          type="area"
          height="350"
          width="700"
          :options="chartOptions"
          :series="series"
          style="color: black"
        ></apexchart>
      </div>

      <div v-else class="flex column items-center justify-center full-height">
        <q-icon name="bar_chart" size="48px" color="grey-5" class="q-mb-md" />
        <div class="text-subtitle1 text-grey-6 text-center">No execution data available</div>
      </div>
    </template>
  </InfoCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import InfoCard from './InfoCard.vue';
import { useQuasar } from 'quasar';

interface AreaSeries {
  name: string;
  data: [number, number][] | { x: number | string | Date; y: number }[];
}

const props = defineProps<{
  series: AreaSeries[];
}>();

const hasData = computed(() => {
  if (!Array.isArray(props.series) || props.series.length === 0) return false;
  return props.series.some((s) => Array.isArray((s as any).data) && (s as any).data.length > 0);
});

const chartOptions = computed(() => ({
  chart: {
    type: 'area',
    height: 350,
    width: '100%',
    stacked: false,
    events: {
      selection: function () {},
    },
  },
  colors: ['#008FFB', '#00E396', '#EDF101', '#F30F0F', '#0814B1', '#4A09BB', '#26A69A'],
  dataLabels: {
    enabled: false,
  },
  stroke: {
    curve: 'straight',
  },
  fill: {
    type: 'gradient',
    gradient: {
      opacityFrom: 0.6,
      opacityTo: 0.2,
    },
  },
  legend: {
    position: 'right',
  },
  xaxis: {
    type: 'datetime',
    title: {
      text: 'Date',
    },
  },
  yaxis: [
    {
      title: {
        text: '# of Executions',
      },
      labels: {
        formatter: function (value: number) {
          return Math.round(value).toString();
        },
      },
    },
    {
      opposite: true,
      title: {
        text: 'Server Metrics',
      },
      labels: {
        formatter: function (value: number) {
          return Math.round(value).toString();
        },
      },
    },
  ],
}));
</script>
