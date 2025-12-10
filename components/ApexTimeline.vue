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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { storeToRefs } from 'pinia';
import { useAppStore } from '../stores/app';

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

const MAX_ROWS = 200;
const FALLBACK_LENGTH_MS = 200;
const displayedItems = computed(() => {
  const items = props.itemMap || [];
  const seen = new Set<string>();
  const out: TimelineItem[] = [];
  for (const it of items) {
    const id = (it && (it.uuid as string)) || (it && (it.id as string)) || null;
    if (!id) continue;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(it as TimelineItem);
    }
  }

  const parseTs = (it: TimelineItem) => {
    const s = (it && ((it.started as unknown) || (it.created as unknown))) as string | undefined | null;
    if (!s) return Number.POSITIVE_INFINITY;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };

  out.sort((a, b) => parseTs(a) - parseTs(b));
  return out.slice(0, MAX_ROWS);
});


watch(
  () => props.itemMap,
  (val) => {
    if (Array.isArray(val)) {
      console.log(`[ApexTimeline] received ${val.length} items, rendering ${displayedItems.value.length}`);
      if (val.length > MAX_ROWS) console.warn(`[ApexTimeline] Display limited to first ${MAX_ROWS} items to avoid performance issues.`);
    }
  },
  { immediate: true }
);

const chartSeries = computed(() => {
  if (!props.itemMap || props.itemMap.length === 0) {
    return [];
  }
  const MIN_BAR_LENGTH = 60;

  const barItems = displayedItems.value.filter((it) => !(it as any).signal && (it as any).type !== 'signal');
  const signalItems = displayedItems.value.filter((it) => (it as any).signal || (it as any).type === 'signal');

  const data = barItems.map((item, index) => {
    const parsedStart = (item.started || item.created) ? Date.parse(String(item.started || item.created)) : NaN;
    const hasStart = Number.isFinite(parsedStart);
    const parsedEnd = item.ended ? Date.parse(String(item.ended)) : NaN;
    const hasEnd = Number.isFinite(parsedEnd);

    let startTime = hasStart ? parsedStart : Date.now();
    let endTime = hasEnd ? parsedEnd : (hasStart ? parsedStart + FALLBACK_LENGTH_MS : Date.now() + FALLBACK_LENGTH_MS);

    const missingTs = !hasStart || !hasEnd;
    if (missingTs) {
      startTime = startTime;
      endTime = startTime + FALLBACK_LENGTH_MS;
    }
    if (!missingTs && endTime - startTime < MIN_BAR_LENGTH) {
      endTime = startTime + MIN_BAR_LENGTH;
    }

    const uniqueRowName = `${index + 1}: ${item.name || item.label}`;
    const baseColor = generateColors(index);
    const safeId = `grad-${String(item.uuid || item.id || index).replace(/[^a-z0-9-_]/gi, '-')}`;
    const fill = missingTs ? `url(#${safeId})` : baseColor;
    const meta = { ...item, _shortDuration: !!missingTs, _baseColor: baseColor, _gradId: safeId } as any;

    return {
      x: uniqueRowName,
      y: [startTime, endTime],
      fillColor: fill,
      meta,
    };
  });
  // include signal timestamps when calculating min/max so annotations are visible
  const signalTimes = signalItems
    .map((s) => {
      const t = (s.started || s.created || s.ended) as string | undefined | null;
      if (!t) return NaN;
      const v = Date.parse(String(t));
      return Number.isFinite(v) ? v : NaN;
    })
    .filter(Number.isFinite);

  const allTimes = data.flatMap((d) => d.y).concat(signalTimes as number[]);
  const minTime = allTimes.length > 0 ? Math.min(...allTimes) : Date.now();
  const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : Date.now();
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

const tick = ref(Date.now());
let tickInterval: number | null = null;
onMounted(() => {
  tickInterval = window.setInterval(() => {
    tick.value = Date.now();
  }, 1000);
});
onBeforeUnmount(() => {
  if (tickInterval) window.clearInterval(tickInterval);
});

const chartOptions = computed(() => {
  // reference tick.value so computed re-evaluates each second and refreshes labels
  const _now = tick.value;
  const labelColor = isDarkMode.value ? '#e0e0e0' : '#20242c';
  const xLabelColor = isDarkMode.value ? '#e0e0e0' : '#20242c';
  return {
    chart: {
      type: 'rangeBar',
      height: Math.max(400, props.itemMap.length * 40 + 100),

      toolbar: {
        show: false,
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
      events: {
        mounted: function (chartContext: any, config: any) {
          try {
            injectGradients(chartContext);
          } catch (e) {
            console.error('injectGradients error (mounted):', e);
          }
        },
        updated: function (chartContext: any, config: any) {
          try {
            injectGradients(chartContext);
          } catch (e) {
            console.error('injectGradients error (updated):', e);
          }
        },
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
        try {
          const start = val && val[0] ? new Date(val[0]) : null;
          const seriesIndex = opts.seriesIndex;
          const dataPointIndex = opts.dataPointIndex;
          const series = opts.w && opts.w.config && opts.w.config.series ? opts.w.config.series : null;
          const dataPoint = series && series[seriesIndex] && series[seriesIndex].data ? series[seriesIndex].data[dataPointIndex] : null;
          const item = (dataPoint && dataPoint.meta) || {};

          let end = null;
          if (item.ended && val && val[1]) {
            end = new Date(val[1]);
          }
          const durationSeconds = start ? ((end ? end.getTime() : Date.now()) - start.getTime()) / 1000 : 0;

          if (durationSeconds < 60) {
            return `${durationSeconds.toFixed(1)}s`;
          } else if (durationSeconds < 3600) {
            return `${(durationSeconds / 60).toFixed(1)}m`;
          } else {
            return `${(durationSeconds / 3600).toFixed(1)}h`;
          }
        } catch (e) {
          return '';
        }
      },
      style: {
        colors: ['#fff'],
        fontSize: '11px',
        fontWeight: 'bold',
      },
    },
    xaxis: (() => {
      let minX, maxX;
      if (displayedItems.value && displayedItems.value.length > 0) {
        const starts = displayedItems.value
          .map((item) => Date.parse(String(item.started || item.created)))
          .filter((t) => Number.isFinite(t));
        const ends = displayedItems.value
          .map((item) => (item.ended ? Date.parse(String(item.ended)) : NaN))
          .filter((t) => Number.isFinite(t));
        const allStarts = starts.length > 0 ? starts : [Date.now()];
        const allEnds = ends.length > 0 ? ends : [Math.max(...allStarts) + FALLBACK_LENGTH_MS];
        minX = Math.min(...allStarts);
        maxX = Math.max(...allEnds);
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
    annotations: (() => {
      let minX, maxX;
      if (displayedItems.value && displayedItems.value.length > 0) {
        const starts = displayedItems.value
          .map((item) => Date.parse(String(item.started || item.created)))
          .filter((t) => Number.isFinite(t));
        const ends = displayedItems.value
          .map((item) => (item.ended ? Date.parse(String(item.ended)) : NaN))
          .filter((t) => Number.isFinite(t));
        const allStarts = starts.length > 0 ? starts : [Date.now()];
        const allEnds = ends.length > 0 ? ends : [Math.max(...allStarts) + FALLBACK_LENGTH_MS];
        minX = Math.min(...allStarts);
        maxX = Math.max(...allEnds);
        minX = Math.floor(minX / 1000) * 1000;
        maxX = Math.ceil(maxX / 1000) * 1000;
        if (maxX - minX < 1000) {
          maxX = minX + 1000;
        }
        const markers: any[] = [];
        const maxMarkers = 1000;
        let markerCount = Math.floor((maxX - minX) / 1000);
        if (markerCount > maxMarkers) markerCount = maxMarkers;
        const step = Math.max(1000, Math.floor((maxX - minX) / markerCount) || 1000);
        for (let t = minX + 500; t < maxX; t += step) {
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

        // Add point annotations for signal items (they are single timestamps)
        const signalItems = displayedItems.value.filter((it) => (it as any).signal || (it as any).type === 'signal');
        for (let i = 0; i < signalItems.length; i++) {
          const it: any = signalItems[i];
          const tsStr = it.started || it.created || it.ended || null;
          if (!tsStr) continue;
          const t = Date.parse(String(tsStr));
          if (!Number.isFinite(t)) continue;
          const borderColor = '#29F70E';
          markers.push({
            x: t,
            borderColor,
            label: {
              style: {
                color: '#fff',
                background: borderColor,
              },
              text: String(it.label || it.name || it.uuid || '').slice(0, 40),
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
        const item = data.meta || {};

        const start = data && data.y && data.y[0] ? new Date(data.y[0]) : null;
        const end = item.ended && data && data.y && data.y[1] ? new Date(data.y[1]) : null;
        const durationSeconds = start
          ? ((item.ended && end ? end.getTime() : Date.now()) - start.getTime()) / 1000
          : null;

        const formatDuration = (seconds: number | null) => {
          if (seconds === null) return '';
          if (seconds < 60) return `${seconds.toFixed(1)}s`;
          if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
          return `${(seconds / 3600).toFixed(1)}h`;
        };

        let html = '<div class="apex-tooltip">';

        if (item.name || item.label) {
          html += `<div class="tooltip-title">${item.name || item.label}</div>`;
        }

        html += '<div class="tooltip-content">';

        if (item.uuid) {
          html += `<div><strong>UUID:</strong> ${String(item.uuid).slice(0, 8)}...</div>`;
        }

        const typeVal = item.type || (item.signal ? 'signal' : null);
        if (typeVal) {
          const prettyType = String(typeVal).charAt(0).toUpperCase() + String(typeVal).slice(1);
          html += `<div><strong>Type:</strong> ${prettyType}</div>`;
        }

        if (start) {
          html += `<div><strong>Started:</strong> ${start.toLocaleString()}</div>`;
        }

        if (end) {
          html += `<div><strong>Ended:</strong> ${end.toLocaleString()}</div>`;
        }

        if (durationSeconds !== null && !item.signal) {
          html += `<div><strong>Duration:</strong> ${formatDuration(durationSeconds)}</div>`;
        }

        if (typeof item.progress === 'number') {
          html += `<div><strong>Progress:</strong> ${item.progress}%</div>`;
        }

        if (item.layer_index !== undefined && item.layer_index !== null) {
          html += `<div><strong>Layer:</strong> ${item.layer_index}</div>`;
        }

        const hasStatusField =
          item.errored !== undefined || item.failed !== undefined || item.isComplete !== undefined;
        if (hasStatusField) {
          html += `<div><strong>Status:</strong> <span class="status-${getStatusClass(
            item
          )}">${getStatusText(item)}</span></div>`;
        }

        if (item.description) {
          html += `<div><strong>Description:</strong> ${item.description}</div>`;
        }

        html += '<div class="tooltip-action">Click to view details</div>';
        html += '</div></div>';

        return html;
      },
    },
    stroke: {
      width: 0,
      colors: [],
    },
  };
});

function injectGradients(chartContext: any) {
  if (!chartContext || !chartContext.el) return;
  const root = chartContext.el;
  const svg = root.querySelector && root.querySelector('svg');
  if (!svg) return;

  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  const seriesData = chartSeries.value && chartSeries.value[0] && chartSeries.value[0].data ? chartSeries.value[0].data : [];

  for (let i = 0; i < seriesData.length; i++) {
    const dp = seriesData[i];
    const m = dp.meta || {};
    if (!m._shortDuration) continue;
    const id = m._gradId;
    if (!id) continue;
    if (defs.querySelector(`#${id}`)) continue;

    const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', id);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '0%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', m._baseColor || '#666');
    stop1.setAttribute('stop-opacity', '1');

    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', m._baseColor || '#666');
    stop2.setAttribute('stop-opacity', '0');

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
  }
}

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
  overflow-y: 100%;
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

/* Disable ApexCharts tooltip animation and any transition effects */
:deep(.apex-tooltip) {
  transition: none !important;
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}

:deep(.apexcharts-tooltip) {
  transition: none !important;
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}

:deep(.apexcharts-tooltip *) {
  transition: none !important;
  animation: none !important;
}
</style>
