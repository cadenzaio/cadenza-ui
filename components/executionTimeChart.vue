<template>
  <InfoCard>
    <template #title> Execution Times </template>
    <template #info>
      <div>
        <apexchart
          type="area"
          height="350"
          width="700"
          :options="chartOptions"
          :series="series"
          style="color: black"
        ></apexchart>
      </div>
    </template>
  </InfoCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import InfoCard from './InfoCard.vue';

// ApexCharts series type for area chart
interface AreaSeries {
  name: string;
  data: [number, number][] | { x: number | string | Date; y: number }[];
}

const props = defineProps<{
  series: AreaSeries[];
}>();

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
  colors: ['#008FFB', '#00E396', '#CED4DC'],
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
      opacityTo: 0.8,
    },
  },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
  },
  xaxis: {
    type: 'datetime',
    title: {
      text: 'Date',
    },
  },
  yaxis: {
    title: {
      text: 'Execution Time (seconds)',
    },
    labels: {
      formatter: function (value: number) {
        return value.toFixed(2); // Format to 2 decimal places
      },
    },
  },
}));
</script>
