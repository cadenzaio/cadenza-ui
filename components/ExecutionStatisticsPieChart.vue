<template>
  <InfoCard>
    <template #title> Execution Statistics </template>
    <template #info>
      <div>
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
  },
  data() {
    return {
      series: [],
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
  async mounted() {
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
  },
};
</script>
