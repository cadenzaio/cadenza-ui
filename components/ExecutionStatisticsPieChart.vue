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
    taskName: String,
    taskName: String,
    routineId: String,
    routineName: String,
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
        const name = this.routineName ?? this.routineId;
        url = `/api/routineErrors?routineName=${encodeURIComponent(name ?? '')}`;
      } else if (this.type === 'task') {
        const name = this.taskName ?? this.taskName;
        url = `/api/taskErrors?taskName=${encodeURIComponent(name ?? '')}`;
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

        const rawErrored = statsObj.errored ?? statsObj.errored_count ?? statsObj.error ?? Object.values(statsObj)[1];
        const rawFailed = statsObj.failed ?? statsObj.failed_count ?? Object.values(statsObj)[2];
        const rawIsComplete =
          statsObj.is_complete ?? statsObj.isComplete ?? statsObj.is_complete_count ?? statsObj.completed ?? null;
        const rawExecutions = statsObj.executions ?? statsObj.count ?? Object.values(statsObj)[0];

        errored = Number(rawErrored ?? 0);
        failed = Number(rawFailed ?? 0);

        if (rawIsComplete !== null && rawIsComplete !== undefined) {
          isComplete = Number(rawIsComplete || 0);
        } else if (rawExecutions !== undefined && rawExecutions !== null) {
          const executionsNum = Number(rawExecutions || 0);
          isComplete = Math.max(0, executionsNum - errored - failed);
        } else {
          isComplete = 0;
        }
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
