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

<script>
import { colors } from 'quasar';
import VueApexCharts from 'vue3-apexcharts';

export default {
  components: {
    apexchart: VueApexCharts,
  },
  props: {
    series: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      chartOptions: {
        chart: {
          type: 'area',
          height: 350,
          width: '100%',
          stacked: false,
          events: {
            selection: function (chart, e) {},
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
            formatter: function (value) {
              return value.toFixed(2); // Format to 2 decimal places
            },
          },
        },
      },
    };
  },
  // No methods or mounted needed; data is passed as a prop
};
</script>
