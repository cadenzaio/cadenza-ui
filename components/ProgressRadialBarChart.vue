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

<script>
import { defineComponent } from 'vue';
import VueApexCharts from 'vue3-apexcharts';

export default defineComponent({
  components: {
    apexchart: VueApexCharts,
  },
  props: {
    value: {
      type: String,
      required: true,
      default: '0%'
    },
    name: {
      type: String,
      required: true,
    }
  },
  data() {
    return {
      series: [this.value.replace('%', '')],
      chartOptions: {
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
                }
              },
            },
            labels: ['Progress'],
          },
    };
  },
});

</script>
