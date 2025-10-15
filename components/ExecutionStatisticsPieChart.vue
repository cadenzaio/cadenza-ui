<template>
  <InfoCard>
    <template #title> Execution Statistics </template>
    <template #info>
      <div v-if="isLoading" class="flex column items-center justify-center full-height">
        <q-spinner-dots size="40px" color="primary" class="q-mb-md" />
        <div class="text-subtitle1">Loading execution statistics...</div>
      </div>
      
      <div v-else-if="!hasData" class="flex column items-center justify-center full-height">
        <q-icon name="bar_chart" size="48px" color="grey-5" class="q-mb-md" />
        <div class="text-subtitle1 text-grey-6 text-center">No execution data available</div>
      </div>
      
      <div v-else>
        <apexchart
          type="pie"
          :options="chartOptions"
          :series="series"
          width="550"
        ></apexchart>
      </div>
    </template>
  </InfoCard>
</template>

<script>
import VueApexCharts from 'vue3-apexcharts';

export default {
  components: {
    apexchart: VueApexCharts,
  },
  props: {
    type: String,
    taskId: String,
    routineId: String,
    loading: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      series: [],
      isLoading: false,
      hasData: false,
      chartOptions: {
        chart: {
          width: 380,
          type: 'pie',
        },
        labels: ['Successful', 'Errored', 'Failed'],
        colors: ['#4a9eff', '#ff6699', '#ffcc44'],
        responsive: [
          {
            breakpoint: 480,
            options: {
              chart: {
                width: 200,
              },
              legend: {
                position: 'bottom',
                fontSize: '16px',
              },
            },
          },
        ],
        legend: {
          fontSize: '22px',
        },
      },
    };
  },
  watch: {
    loading: {
      immediate: true,
      handler(newVal) {
        this.isLoading = newVal;
      },
    },
  },
  async mounted() {
    if (!this.loading) {
      this.isLoading = true;
    }
    
    try {
      let url;
      if (this.type === 'routine') {
        url = `/api/routineErrors?routineId=${this.routineId}`;
      } else if (this.type === 'task') {
        url = `/api/taskErrors?taskId=${this.taskId}`;
      } else {
        url = `/api/allErrors`;
      }

      const { data } = await useFetch(url);
      let isComplete = 0,
        errored = 0,
        failed = 0;
      
      if (
        Array.isArray(data.value) &&
        data.value.length > 0 &&
        typeof data.value[0] === 'object'
      ) {
        const statsObj = data.value[0];
        // Try to get by key, fallback to values order if needed
        isComplete = Number(
          statsObj.isComplete ?? Object.values(statsObj)[0] ?? 0
        );
        errored = Number(statsObj.errored ?? Object.values(statsObj)[1] ?? 0);
        failed = Number(statsObj.failed ?? Object.values(statsObj)[2] ?? 0);
      }
      
      this.series = [isComplete, errored, failed];
      this.hasData = isComplete > 0 || errored > 0 || failed > 0;
    } catch (error) {
      console.error('Error fetching execution statistics:', error);
      this.series = [];
      this.hasData = false;
    } finally {
      this.isLoading = false;
    }
  },
};
</script>
