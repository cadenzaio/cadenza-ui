<template>
  <InfoCard class="custom-card">
    <template #title>
      Execution Frequency
    </template>
    <template #info>
      <div>
        <apexchart type="pie" :options="chartOptions" :series="series" width="600"></apexchart>
      </div>
    </template>
  </InfoCard>
</template>

<script>
import VueApexCharts from 'vue3-apexcharts';

export default {
  components: {
    apexchart: VueApexCharts
  },
  props: {
    values: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      chartOptions: {
        chart: {
          type: 'pie',
          height: 350
        },
        labels: [],
        colors: [],
        legend: {
          show: false
        },
        tooltip: {
          y: {
            formatter: function(val) {
              return val + ' executions';
            }
          }
        },
        dataLabels: {
          enabled: true,
          formatter: function (val, opts) {
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
            borderColor: '#fff'
          },
          style: {
            colors: ['rgb(200,200,200)'],
            fontSize: '14px',
          }
        }
      },
      series: []
    };
  },
  watch: {
    values: {
      immediate: true,
      handler(newValues) {
        if (newValues && newValues.length) {
          this.updateChart(newValues);
        } else {
          this.resetChart();
        }
      }
    }
  },
  methods: {
    updateChart(values) {
      const groupedData = values.reduce((acc, value) => {
        const service = value.processingGraph || '';
        const name = value.name || 'Unnamed';
        const key = `${service} ${name}`;
        if (!acc[key]) {
          acc[key] = { service, name, count: 0 };
        }
        acc[key].count++;
        return acc;
      }, {});

      const sortedData = Object.values(groupedData).sort((a, b) => a.service.localeCompare(b.service));
      const labels = [];
      const series = [];
      const colors = [];
      const predefinedColors = [
        '#6b8fd4', '#c4a875', '#9b85c4', '#85c4a8', '#d49575',
        '#7ba8d4', '#d4b895', '#b895d4', '#a8d4b5', '#e8a575',
        '#5a7bc4', '#c4b885', '#8575c4', '#95c4a8', '#d4a575',
        '#95b5e8', '#e8d4b5', '#d4b5e8', '#b5e8d4', '#f4c485'
      ];
      let colorIndex = 0;
      const colorMap = {};

      sortedData.forEach((item) => {
        labels.push(`${item.service}  ${item.name}`);
        series.push(item.count);

        const colorKey = item.service || `${item.name}-${colorIndex}`;
        if (!colorMap[colorKey]) {
          colorMap[colorKey] = predefinedColors[colorIndex % predefinedColors.length];
          colorIndex++;
        }
        colors.push(colorMap[colorKey]);
      });

      this.chartOptions.labels = labels;
      this.chartOptions.colors = colors;
      this.series = series;
    },
    resetChart() {
      this.chartOptions.labels = [];
      this.chartOptions.colors = [];
      this.series = [];
    }
  }
};
</script>

<style scoped>
.custom-card {
  border-radius: 20px !important;
  min-width: 25dvw !important;
  height: 60dvh !important;
}
</style>
