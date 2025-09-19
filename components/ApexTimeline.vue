<template>
  <q-card class="apex-timeline-container">
    <div v-if="loading" class="loading-state">
      <q-spinner-dots size="48px" color="primary" />
      <p class="text-grey-6">Loading timeline data...</p>
    </div>
    <apexchart
      v-else-if="chartSeries.length > 0"
      type="rangeBar"
      :height="Math.max(400, itemMap.length * 40 + 150)"
      :options="chartOptions"
      :series="chartSeries"
      @dataPointSelection="onDataPointSelection"
    />
    <div v-else class="no-data-message">
      <q-icon name="timeline" size="48px" color="grey-5" />
      <p class="text-grey-5">No timeline data available</p>
      <p class="text-caption text-grey-6">
        Task execution data will appear here when available
      </p>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app';
// Access dark mode from app store
const appStore = useAppStore();
const { isDarkMode } = storeToRefs(appStore);

interface TimelineItem {
  label: string;
  uuid: string;
  name: string;
  started: string;
  created: string;
  ended: string;
  progress: number;
  errored: boolean;
  failed: boolean;
  isComplete: boolean;
  layer_index: number;
  description?: string;
  [key: string]: unknown;
}

const props = defineProps<{
  itemMap: TimelineItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  'task-selected': [item: TimelineItem];
}>();

// Generate colors for different tasks
const generateColors = (index: number) => {
  const colors = [
    '#3742fa',
    '#ff6b6b',
    '#ffa502',
    '#7bed9f',
    '#5352ed',
    '#ff9ff3',
    '#70a1ff',
    '#a4b0be',
    '#57606f',
    '#2f3542',
    '#ff3838',
    '#ff9500',
    '#ffdd59',
    '#32ff7e',
    '#7d5fff',
    '#ff5e5b',
    '#3dd5f3',
    '#F8B500',
    '#6c5ce7',
    '#a29bfe',
    '#fd79a8',
    '#e17055',
    '#00b894',
    '#00cec9',
    '#74b9ff',
    '#0984e3',
    '#6c5ce7',
    '#a29bfe',
  ];
  return colors[index % colors.length];
};

// Convert itemMap to ApexCharts series format - each task gets its own row
// Debug: log incoming itemMap and highlight any with missing/invalid dates
watch(
  () => props.itemMap,
  (val) => {
    console.log('[ApexTimeline] received itemMap', val);
    if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (!item.started || isNaN(new Date(item.started).getTime())) {
          console.warn(
            `[ApexTimeline] Item ${idx} missing or invalid started:`,
            item
          );
        }
        if (!item.ended && !item.isComplete) {
          console.warn(
            `[ApexTimeline] Item ${idx} missing ended (may be running):`,
            item
          );
        }
      });
    }
  },
  { immediate: true }
);

const chartSeries = computed(() => {
  if (!props.itemMap || props.itemMap.length === 0) {
    return [];
  }

  // Minimum bar length
  const MIN_BAR_LENGTH = 60;

  // Create a single series with each task as a separate data point
  const data = props.itemMap.map((item, index) => {
    const startTime = new Date(
      (item.started || item.created) as string
    ).getTime();
    let endTime = item.ended ? new Date(item.ended).getTime() : Date.now();

    // Enforce minimum bar length
    if (endTime - startTime < MIN_BAR_LENGTH) {
      endTime = startTime + MIN_BAR_LENGTH;
    }

    // Create a unique row name by combining task name with index or UUID
    const uniqueRowName = `${index + 1}: ${item.name || item.label}`;
    console.log(
      `[ApexTimeline] Task ${index} (${item.name || item.label}) times:`,
      new Date(startTime).toISOString(),
      'to',
      new Date(endTime).toISOString()
    );
    return {
      x: uniqueRowName,
      y: [startTime, endTime],
      fillColor: generateColors(index),
      strokeColor: '#fff',
      meta: item,
    };
  });

  // Debug: log chartSeries and min/max times
  const allTimes = data.flatMap((d) => d.y);
  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  console.log('[ApexTimeline] chartSeries', data);
  console.log(
    '[ApexTimeline] minTime',
    new Date(minTime).toISOString(),
    'maxTime',
    new Date(maxTime).toISOString()
  );

  return [
    {
      name: 'Tasks',
      data,
    },
  ];
});

const chartOptions = computed(() => {
  // Colors for labels
  const labelColor = isDarkMode.value ? '#e0e0e0' : '#20242c';
  const xLabelColor = isDarkMode.value ? '#e0e0e0' : '#20242c';
  return {
    chart: {
      type: 'rangeBar',
      height: Math.max(400, props.itemMap.length * 40 + 100),

      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: false,
          zoomin: false,
          zoomout: false,
          pan: false,
          reset: false,
        },
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
      zoom: {
        enabled: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '70%',
        rangeBarGroupRows: false,
        rangeBarOverlap: false,
        distributed: true,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: function (val: any, opts: any) {
        const start = new Date(val[0]);
        const end = new Date(val[1]);
        const duration = (end.getTime() - start.getTime()) / 1000;

        if (duration < 60) {
          return `${duration.toFixed(1)}s`;
        } else if (duration < 3600) {
          return `${(duration / 60).toFixed(1)}m`;
        } else {
          return `${(duration / 3600).toFixed(1)}h`;
        }
      },
      style: {
        colors: ['#fff'],
        fontSize: '11px',
        fontWeight: 'bold',
      },
    },
    xaxis: (() => {
      // Calculate min and max for x-axis to always show the full second
      let minX, maxX;
      if (props.itemMap && props.itemMap.length > 0) {
        minX = Math.min(
          ...props.itemMap.map((item) => new Date(item.started).getTime())
        );
        maxX = Math.max(
          ...props.itemMap.map((item) =>
            item.ended ? new Date(item.ended).getTime() : Date.now()
          )
        );
        minX = Math.floor(minX / 1000) * 1000;
        maxX = Math.ceil(maxX / 1000) * 1000;
        if (maxX - minX < 1000) {
          maxX = minX + 1000;
        }
      }
      return {
        type: 'datetime',
        min: minX,
        max: maxX,
        labels: {
          datetimeUTC: false,
          format: 'HH:mm:ss',
          style: {
            fontSize: '12px',
            colors: [xLabelColor],
          },
        },
        axisBorder: {
          show: true,
        },
        axisTicks: {
          show: true,
        },
      };
    })(),
    // Add vertical markers at every 0.5 second between minX and maxX
    annotations: (() => {
      let minX, maxX;
      if (props.itemMap && props.itemMap.length > 0) {
        minX = Math.min(
          ...props.itemMap.map((item) => new Date(item.started).getTime())
        );
        maxX = Math.max(
          ...props.itemMap.map((item) =>
            item.ended ? new Date(item.ended).getTime() : Date.now()
          )
        );
        minX = Math.floor(minX / 1000) * 1000;
        maxX = Math.ceil(maxX / 1000) * 1000;
        if (maxX - minX < 1000) {
          maxX = minX + 1000;
        }
        const markers = [];
        for (let t = minX + 500; t < maxX; t += 1000) {
          markers.push({
            x: t,
            borderColor: '#bbb',
            strokeDashArray: 4,
            label: {
              style: {
                color: '#bbb',
                fontSize: '10px',
                background: 'transparent',
              },
              orientation: 'horizontal',
              offsetY: 10,
            },
          });
        }
        return { xaxis: markers };
      }
      return { xaxis: [] };
    })(),
    yaxis: {
      labels: {
        style: {
          fontSize: '11px',
          fontWeight: '500',
          colors: [labelColor],
        },
        maxWidth: 200,
      },
    },
    grid: {
      show: true,
      borderColor: '#e0e0e0',
      strokeDashArray: 2,
      position: 'back',
      xaxis: {
        lines: {
          show: true,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
      row: {
        colors: ['#f8f9fa', 'transparent'],
        opacity: 0.3,
      },
    },
    legend: {
      show: false,
    },
    tooltip: {
      enabled: true,
      shared: false,
      intersect: true,
      followCursor: true,
      style: {
        fontSize: '12px',
      },
      custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
        const data = w.config.series[seriesIndex].data[dataPointIndex];
        const item = data.meta;
        const start = new Date(data.y[0]);
        const end = new Date(data.y[1]);
        const duration = (end.getTime() - start.getTime()) / 1000;

        const formatDuration = (seconds: number) => {
          if (seconds < 60) return `${seconds.toFixed(1)}s`;
          if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
          return `${(seconds / 3600).toFixed(1)}h`;
        };

        return `
        <div class="apex-tooltip">
          <div class="tooltip-title">${item.name || item.label}</div>
          <div class="tooltip-content">
            <div><strong>UUID:</strong> ${item.uuid.slice(0, 8)}...</div>
            <div><strong>Started:</strong> ${start.toLocaleString()}</div>
            <div><strong>Ended:</strong> ${
              item.ended ? end.toLocaleString() : 'Running...'
            }</div>
            <div><strong>Duration:</strong> ${formatDuration(duration)}</div>
            <div><strong>Progress:</strong> ${item.progress}%</div>
            <div><strong>Layer:</strong> ${item.layer_index}</div>
            <div><strong>Status:</strong> <span class="status-${getStatusClass(
              item
            )}">${getStatusText(item)}</span></div>
            ${
              item.description
                ? `<div><strong>Description:</strong> ${item.description}</div>`
                : ''
            }
            <div class="tooltip-action">Click to view details</div>
          </div>
        </div>
      `;
      },
    },
    stroke: {
      width: 1,
      colors: ['#fff'],
    },
  };
});

const getStatusText = (item: TimelineItem) => {
  if (item.errored) return 'Error';
  if (item.failed) return 'Failed';
  if (item.isComplete) return 'Completed';
  return 'Running';
};

const getStatusClass = (item: TimelineItem) => {
  if (item.errored || item.failed) return 'error';
  if (item.isComplete) return 'success';
  return 'running';
};

interface ApexDataPointSelectionConfig {
  seriesIndex: number;
  dataPointIndex: number;
  [key: string]: unknown;
}
const onDataPointSelection = (
  event: MouseEvent,
  chartContext: unknown,
  config: ApexDataPointSelectionConfig
) => {
  const { seriesIndex, dataPointIndex } = config;
  const selectedData = chartSeries.value[0]?.data[dataPointIndex];
  if (selectedData && selectedData.meta) {
    emit('task-selected', selectedData.meta as TimelineItem);
  }
};
</script>

<style scoped>
.apex-timeline-container {
  border-radius: 20px !important;
  width: 100%;
  max-width: 85dvw;
  min-height: 400px;
  max-height: 800px;
  overflow-y: auto;
  padding: 60px 20px 20px 20px;
  position: relative;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
}

.no-data-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
}

:deep(.apex-tooltip) {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  font-family: inherit;
  max-width: 300px;
}

:deep(.tooltip-title) {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
  color: #1f2937;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 4px;
}

:deep(.tooltip-content) {
  font-size: 12px;
  line-height: 1.4;
  color: #4b5563;
}

:deep(.tooltip-content div) {
  margin-bottom: 4px;
}

:deep(.tooltip-content strong) {
  color: #1f2937;
}

:deep(.status-error) {
  color: #dc2626;
  font-weight: bold;
}

:deep(.status-success) {
  color: #16a34a;
  font-weight: bold;
}

:deep(.status-running) {
  color: #2563eb;
  font-weight: bold;
}

:deep(.tooltip-action) {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
  font-style: italic;
  color: #6b7280;
  font-size: 11px;
}
</style>
