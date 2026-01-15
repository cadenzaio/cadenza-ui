<template>
  <InfoCard>
    <template #title> Service Statistics </template>
    <template #info>
      <div v-if="hasData">
        <apexchart
          ref="mainChart"
          type="area"
          height="300"
          width="100%"
          :options="chartOptions"
          :series="chartSeries"
          style="color: black"
        ></apexchart>
        <!-- Brush chart for scrollbar/range selection -->
        <apexchart
          type="area"
          height="100"
          width="100%"
          :options="brushChartOptions"
          :series="brushSeries"
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
import { computed, ref } from 'vue';
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

// Calculate the default zoom range (last 12 hours)
const getDefaultZoomRange = computed(() => {
  const now = Date.now();
  const twelveHoursAgo = now - 12 * 60 * 60 * 1000;
  return { min: twelveHoursAgo, max: now };
});

// Reference to the main chart
const mainChart = ref<any>(null);

// Current zoom range (controlled by brush chart)
const currentZoom = ref({
  min: getDefaultZoomRange.value.min,
  max: getDefaultZoomRange.value.max,
});

// Handle brush selection change
const onBrushSelection = (chartContext: any, { xaxis }: any) => {
  if (xaxis && mainChart.value) {
    currentZoom.value = { min: xaxis.min, max: xaxis.max };
    mainChart.value.zoomX(xaxis.min, xaxis.max);
  }
};

// Server metric names that should use the percentage axis (0-100%)
const serverMetricNames = ['CPU (%)', 'Disk (%)', 'Network (%)', 'RAM (%)'];

// Fixed color map for each series name
const seriesColorMap: Record<string, string> = {
  'Task Count': '#096FD5',
  'Signal Count': '#02A192',
  'CPU (%)': '#F1D178',
  'Disk (%)': '#ED7A7A',
  'Network (%)': '#AF57BF',
  'RAM (%)': '#6BCF67',
};

// Assign each series to the correct Y-axis
const chartSeries = computed(() => {
  return props.series.map((s) => {
    return {
      ...s,
    };
  });
});

// Get colors array based on current series order
const chartColors = computed(() => {
  return props.series.map((s) => seriesColorMap[s.name] || '#999999');
});

const chartOptions = computed(() => {
  // Build yaxis array dynamically based on series
  const yaxisConfig: any[] = [];
  
  props.series.forEach((s, index) => {
    const isServerMetric = serverMetricNames.includes(s.name);
    
    if (isServerMetric) {
      yaxisConfig.push({
        seriesName: s.name,
        opposite: true,
        min: 0,
        max: 100,
        show: index === props.series.findIndex(ser => serverMetricNames.includes(ser.name)), // only show first server metric axis
        title: {
          text: index === props.series.findIndex(ser => serverMetricNames.includes(ser.name)) ? 'Server Metrics (%)' : '',
        },
        labels: {
          formatter: function (value: number) {
            return Math.round(value).toString() + '%';
          },
        },
      });
    } else {
      yaxisConfig.push({
        seriesName: s.name,
        opposite: false,
        show: index === props.series.findIndex(ser => !serverMetricNames.includes(ser.name)), // only show first count axis
        title: {
          text: index === props.series.findIndex(ser => !serverMetricNames.includes(ser.name)) ? '# of Executions' : '',
        },
        labels: {
          formatter: function (value: number) {
            return Math.round(value).toString();
          },
        },
      });
    }
  });

  return {
    chart: {
      id: 'serviceTimeChart',
      type: 'area',
      height: 300,
      width: '100%',
      stacked: false,
      zoom: {
        type: 'x',
        enabled: true,
        autoScaleYaxis: true,
      },
      toolbar: {
        autoSelected: 'zoom',
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      events: {
        selection: function () {},
      },
    },
    colors: chartColors.value,
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: 0.5,
        opacityTo: 0.01,
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
    yaxis: yaxisConfig.length > 0 ? yaxisConfig : [
      {
        title: { text: '# of Executions' },
        labels: {
          formatter: function (value: number) {
            return Math.round(value).toString();
          },
        },
      },
    ],
    tooltip: {
      x: {
        formatter: function (value: number) {
          const endDate = new Date(value);
          const startDate = new Date(value - 60 * 60 * 1000); // Subtract 1 hour
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = months[startDate.getMonth()];
          const day = startDate.getDate();
          const year = startDate.getFullYear();
          const startHour = startDate.getHours().toString().padStart(2, '0');
          const startMin = startDate.getMinutes().toString().padStart(2, '0');
          const endHour = endDate.getHours().toString().padStart(2, '0');
          const endMin = endDate.getMinutes().toString().padStart(2, '0');
          return `${month} ${day} ${year} ${startHour}:${startMin}-${endHour}:${endMin}`;
        },
      },
    },
  };
});

// Brush chart series - include Task Count and Signal Count, filtered to exclude future dates
const brushSeries = computed(() => {
  if (props.series.length === 0) return [];
  const result: AreaSeries[] = [];
  const now = Date.now();
  
  // Find Task Count series
  const taskSeries = props.series.find(s => s.name === 'Task Count');
  if (taskSeries) {
    const filteredData = taskSeries.data.filter((point) => {
      const x = Array.isArray(point) ? point[0] : point.x;
      return new Date(x).getTime() <= now;
    });
    result.push({ name: 'Task Count', data: filteredData as AreaSeries['data'] });
  }
  
  // Find Signal Count series
  const signalSeries = props.series.find(s => s.name === 'Signal Count');
  if (signalSeries) {
    const filteredData = signalSeries.data.filter((point) => {
      const x = Array.isArray(point) ? point[0] : point.x;
      return new Date(x).getTime() <= now;
    });
    result.push({ name: 'Signal Count', data: filteredData as AreaSeries['data'] });
  }
  
  // Fallback to first series if neither found
  if (result.length === 0 && props.series[0]) {
    const filteredData = props.series[0].data.filter((point) => {
      const x = Array.isArray(point) ? point[0] : point.x;
      return new Date(x).getTime() <= now;
    });
    result.push({ name: 'Timeline', data: filteredData as AreaSeries['data'] });
  }
  
  return result;
});

// Brush chart options (scrollbar at the bottom)
const brushChartOptions = computed(() => {
  return {
    chart: {
      id: 'brushChart',
      height: 100,
      type: 'area',
      toolbar: {
        show: false,
        autoSelected: 'selection',
      },
      pan: {
        enabled: true,
      },
      selection: {
        enabled: true,
        type: 'x',
        xaxis: {
          min: getDefaultZoomRange.value.min,
          max: getDefaultZoomRange.value.max,
        },
        fill: {
          color: '#008FFB',
          opacity: 0.2,
        },
        stroke: {
          color: '#008FFB',
          width: 1,
        },
      },
      events: {
        selection: onBrushSelection,
      },
    },
    colors: ['#096FD5', '#02A192'], // Task Count blue, Signal Count teal
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: 0.91,
        opacityTo: 0.1,
      },
    },
    tooltip: {
      enabled: false,
    },
    xaxis: {
      type: 'datetime',
      min: Date.now() - 7 * 24 * 60 * 60 * 1000,
      max: Date.now(),
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      tickAmount: 2,
      show: false,
    },
    legend: {
      show: false,
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 1,
    },
  };
});
</script>
