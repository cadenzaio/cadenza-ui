<template>
  <div>
    <apexchart
      type="radialBar"
      :options="chartOptions"
      :series="series"
      height="150"
      width="150"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';

const props = defineProps<{
  value: string;
  name: string;
}>();

const series = computed(() => [Number(props.value.replace('%', ''))]);

const chartOptions = computed(() => ({
  chart: {
    height: 50,
    width: 50,
    background: 'none',
    type: 'radialBar',
  },
  plotOptions: {
    radialBar: {
      hollow: {
        size: '70%',
      },
    },
  },
  labels: ['Progress'],
}));
</script>
