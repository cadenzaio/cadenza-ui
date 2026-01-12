<template>
  <q-card class="heatmap-container">
    <div v-if="loading" class="flex column items-center justify-center q-pa-xl" style="min-height: 300px;">
      <q-spinner-dots size="50px" color="primary" class="q-mb-md" />
      <div class="text-h6">Loading heatmap data...</div>
    </div>
    
    <div v-else-if="!hasData" class="flex column items-center justify-center q-pa-xl" style="min-height: 300px;">
      <q-icon name="grid_view" size="80px" color="grey-4" class="q-mb-md" />
      <div class="text-h5 q-mb-sm text-grey-6">No Heatmap Data Available</div>
      <div class="text-body1 text-grey-5 text-center">
        No routine execution data found for the heatmap visualization.
      </div>
    </div>
    
    <div v-else>
      <div v-show="!showMonthView">
        <apexchart
          type="heatmap"
          height="500"
          :options="chartOptions"
          :series="chartSeries"
          @dataPointSelection="onCellClick"
        />
        <div class="heatmap-header-bottom">
          <q-btn 
            icon="settings" 
            color="primary" 
            @click="showDialog = true"
            :disable="!hasData || loading"
          />
          <q-btn icon="chevron_left" color="primary" @click="decrementYear" />
          <q-select
            v-model="selectedYear"
            :options="effectiveYearOptions"
            label="Year"
            dense
            outlined
            class="year-select"
          />
          <q-btn
            v-if="selectedYear !== currentYear"
            icon="chevron_right"
            color="primary"
            @click="incrementYear"
          />
          <q-btn
            v-if="selectedYear !== currentYear"
            label="This Year"
            color="primary"
            @click="goToCurrentYear"
          />
        </div>
      </div>
      <div v-show="showMonthView">
        <apexchart
          type="heatmap"
          height="500"
          :options="monthChartOptions"
          :series="monthChartSeries"
          @dataPointSelection="onHourCellClick"
        />
        <div class="heatmap-header-bottom">
          <q-btn
            icon="arrow_back"
            color="primary"
            @click="handleBackToYearView"
          />
          <q-btn icon="chevron_left" color="primary" @click="decrementMonth" />
          <q-select
            v-model="selectedMonth"
            :options="props.monthNames.map((m: string) => m)"
            label="Month"
            dense
            outlined
            class="month-select"
          />
          <q-select
            v-model="selectedYear"
            :options="effectiveYearOptions"
            label="Year"
            dense
            outlined
            class="year-select"
          />
          <q-btn
            v-if="
              !(
                selectedMonth === monthNames[currentMonth] &&
                selectedYear === currentYear
              )
            "
            icon="chevron_right"
            color="primary"
            @click="incrementMonth"
          />
          <q-btn
            v-if="
              !(
                selectedMonth === monthNames[currentMonth] &&
                selectedYear === currentYear
              )
            "
            label="This Month"
            color="primary"
            @click="goToCurrentMonth"
          />
          <div class="text-h6 q-ml-md">
            Month: {{ selectedMonth }} Year: {{ selectedYear }}
          </div>
        </div>
      </div>
    </div>
  </q-card>
  <q-dialog v-model="showDialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">Adjust Heatmap Ranges</div>
        <div class="color-bar-container">
          <div class="color-bar">
            <div
              v-for="(range, idx) in editableRanges"
              :key="idx"
              class="color-bar-section"
              :style="{
                background: colorBarColors[idx],
                width: colorBarWidths[idx] + '%',
              }"
            ></div>
          </div>
          <div class="color-bar-labels">
            <span
              v-for="(range, idx) in editableRanges.slice(0, -1)"
              :key="idx"
              class="color-bar-label"
            >
              {{ ['Low', 'Medium', 'High', 'Extreme'][idx] }}
            </span>
          </div>
        </div>
        <div class="range-inputs-horizontal">
          <div
            v-for="(range, idx) in editableRanges.slice(0, -1)"
            :key="idx"
            class="range-input-horizontal"
          >
            <div class="text-caption q-mb-xs">
              {{ ['Low', 'Medium', 'High'][idx] }}: {{ range.from }} to
              {{ range.to }}
            </div>
            <q-input
              v-model.number="range.to"
              :label="`Max value for ${['Low', 'Medium', 'High'][idx]}`"
              type="number"
              :min="range.from"
              :max="
                idx < editableRanges.length - 1
                  ? editableRanges[idx + 1].to - 1
                  : undefined
              "
              :disable="false"
              @update:model-value="
                (val) =>
                  handleMaxChange(Number(val) || editableRanges[idx].from, idx)
              "
              dense
              outlined
              class="range-input"
            />
            <div
              v-if="idx < editableRanges.length - 1"
              class="text-caption q-mt-xs"
            >
              {{ ['Medium', 'High', 'Extreme'][idx] }} starts at
              {{ range.to + 1 }}
            </div>
          </div>
        </div>

        <q-toggle
          v-model="scaleToData"
          label="Scale to Data (Equal Sections)"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn color="primary" label="OK" @click="applyRanges" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="showHourDialog" full-width>
    <q-card>
      <Table :columns="hourTableColumns" :rows="selectedHourData" :title="hourTableTitle" row-key="uuid" @inspect-row="inspectTask" @inspect-row-in-new-tab="inspectInNewTab" />
      <q-card-actions align="right">
        <q-btn color="primary" label="Close" @click="showHourDialog = false" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
// Types
interface RangeSection {
  from: number;
  to: number;
}
interface HeatmapRow {
  date: string;
  hour: number;
  executions: number;
  [key: string]: unknown;
}
interface HeatmapSeriesData {
  x: string;
  y: number;
}
interface HeatmapSeries {
  name: string;
  data: HeatmapSeriesData[];
}
interface HourTableRow {
  uuid: string;
  name: string;
  status: string;
  progress: number;
  started: string;
  ended: string;
  duration: number;
}
const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  hasData: {
    type: Boolean,
    default: true,
  },
  chartSeries: {
    type: Array as () => HeatmapSeries[],
    required: false,
    default: () => [],
  },
  yearOptions: {
    type: Array as () => Array<number>,
    required: true,
  },
  monthNames: {
    type: Array as () => Array<string>,
    required: true,
  },
  editableRanges: {
    type: Array as () => RangeSection[],
    required: true,
  },
  rawHeatmapData: {
    type: Array as () => Array<HeatmapRow>,
    required: false,
    default: () => [],
  },
  serviceName: {
    type: String,
    default: undefined,
  },
});

import {
  useHeatmapSettingsStore,
  type HeatmapSetting,
} from '@/stores/heatmapSettings';
const emit = defineEmits(['update:editableRanges']);

const showMonthView = ref(false);
const selectedMonthIndex = ref(0);
const monthChartSeries = ref<HeatmapSeries[]>([]);
const chartSeries = ref<HeatmapSeries[]>([]);
const heatmapSettingsStore = useHeatmapSettingsStore();
const localEditableRanges = ref<RangeSection[]>([]);
const localScaleToData = ref(false);
const settingsKey = 'default'; 

function getMonthColorScaleRanges() {
  const ranges = props.editableRanges as RangeSection[];
  const lowFrom = 1;
  const lowTo = Math.max(ranges[0].to, 1);
  return [
    { from: 0, to: 0, name: 'no data', color: '#B0B0B0' },
    {
      from: lowFrom,
      to: lowTo,
      name: 'Low',
      color: '#4FC3F7',
    },
    {
      from: ranges[1].from / 24,
      to: ranges[1].to / 24,
      name: 'Medium',
      color: '#43A047',
    },
    {
      from: ranges[2].from / 24,
      to: ranges[2].to / 24,
      name: 'High',
      color: '#FFA500',
    },
    {
      from: ranges[3].from  / 24,
      to: ranges[3].to / 24,
      name: 'Extreme',
      color: '#FF0000',
    },
  ];
}

const modeColor = computed(() => (isDarkMode.value ? '#e0e0e0' : '#20242c'));

const monthChartOptions = computed(() => {
  const xCategories = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const yCategories = Array.from({ length: 31 }, (_, i) => `Day ${31 - i}`);
  return {
    chart: {
      height: 500,
      type: 'heatmap',
      background: 'transparent',
    },
    plotOptions: {
      heatmap: {
        shadeIntensity: 0.5,
        radius: 0,
        enableShades: true,
        colorScale: {
          ranges: getMonthColorScaleRanges(),
        },
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 1 },
    title: {
      text: `${selectedMonth.value} ${selectedYear.value} HeatMap`,
      style: { color: modeColor.value },
    },
    xaxis: {
      categories: xCategories,
      tickPlacement: 'on',
      labels: { style: { colors: modeColor.value } },
    },
    yaxis: {
      categories: yCategories,
      labels: { style: { colors: modeColor.value } },
    },
    tooltip: {
      enabled: true,
      custom: ({
        series,
        seriesIndex,
        dataPointIndex,
      }: {
        series: number[][];
        seriesIndex: number;
        dataPointIndex: number;
      }) => {
        const value = series[seriesIndex][dataPointIndex];
        return `<div style='font-size:16px;padding:4px;color:#000;'>${value}</div>`;
      },
    },
  };
});

interface ApexDataPointSelectionConfig {
  seriesIndex: number;
  dataPointIndex: number;
  [key: string]: unknown;
}
function onCellClick(
  event: MouseEvent,
  chartContext: unknown,
  config: ApexDataPointSelectionConfig
) {
  if (
    config &&
    typeof config.seriesIndex === 'number' &&
    typeof config.dataPointIndex === 'number'
  ) {
    const monthIdx = config.seriesIndex;
    const month = props.monthNames[monthIdx];
    selectedMonth.value = month;
    selectedMonthIndex.value = monthIdx;
    buildMonthChartSeries(monthIdx, selectedYear.value);
    const scrollY = window.scrollY;
    showMonthView.value = true;
    nextTick(() => {
      setTimeout(() => {
        window.scrollTo({ top: scrollY });
      }, 10);
    });
  }
}

function onHourCellClick(
  event: MouseEvent,
  chartContext: unknown,
  config: ApexDataPointSelectionConfig
) {
  if (
    config &&
    typeof config.seriesIndex === 'number' &&
    typeof config.dataPointIndex === 'number'
  ) {
    const dayIdx = config.seriesIndex;
    const hour = config.dataPointIndex;
    const day = 31 - dayIdx; // since y is reversed
    const monthIdx = props.monthNames.indexOf(selectedMonth.value);
    // Calculate date range
    const startDate = new Date(selectedYear.value, monthIdx, day, hour, 0, 0);
    const endDate = new Date(selectedYear.value, monthIdx, day, hour + 1, 0, 0);
    // Determine if on service page
    let service: string | undefined;
    if (props.serviceName) {
      service = props.serviceName;
    }
    // Fetch tasks
    const query: any = {
      started_after: startDate.toISOString().slice(0, 19).replace('T', ' '),
      started_before: endDate.toISOString().slice(0, 19).replace('T', ' '),
      limit: 1000,
    };
    if (service) query.service = service;
    (async () => {
      try {
        const data = await $fetch('/api/activity/tasks/activeTasks', { query });
        selectedHourData.value = (data?.tasks || []) as unknown as HourTableRow[];
        hourTableTitle.value = `Tasks for ${selectedMonth.value} ${day}, ${selectedYear.value} at ${hour}:00${service ? ` (Service: ${service})` : ''}`;
        showHourDialog.value = true;
      } catch (error) {
        console.error('Error fetching tasks:', error);
        selectedHourData.value = [];
        hourTableTitle.value = 'Error loading tasks';
        showHourDialog.value = true;
      }
    })();
  }
}
import VueApexCharts from 'vue3-apexcharts';
import { ref, computed, watch, nextTick } from 'vue';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';
import { ref as qRef } from 'vue';
import Table from '@/components/Table.vue';
import { useRoute, useRouter } from 'vue-router';

function generateData(
  count: number,
  { min, max }: { min: number; max: number }
) {
  let data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      x: `${i + 1}`,
      y: Math.floor(Math.random() * (max - min + 1)) + min,
    });
  }
  return data;
}

function handleMaxChange(val: number, idx: number) {
  if (scaleToData.value) scaleToData.value = false;
  const newRanges = props.editableRanges.map((r) => ({ ...r }));
  if (idx === 0) {
    newRanges[0].from = 1;
    const newVal = typeof val === 'number' ? val : Number(val) || 1;
    newRanges[0].to = Math.max(newVal, 1);
  } else {
    const newVal =
      typeof val === 'number' ? val : Number(val) || newRanges[idx].from;
    if (newVal < newRanges[idx].from) {
      newRanges[idx].to = newRanges[idx].from;
    } else {
      newRanges[idx].to = newVal;
    }
  }
  for (let i = idx + 1; i < newRanges.length; i++) {
    newRanges[i].from = newRanges[i - 1].to + 1;
    if (newRanges[i].to < newRanges[i].from) {
      newRanges[i].to = newRanges[i].from;
    }
  }
  emit('update:editableRanges', newRanges);
}

const appStore = useAppStore();
const { isDarkMode } = storeToRefs(appStore);

const route = useRoute();
const router = useRouter();

const getLabelColor = () => (isDarkMode.value ? '#e0e0e0' : '#20242c');

const labelStyle = {
  color: getLabelColor(),
};

const showDialog = qRef(false);

const showHourDialog = ref(false);
const selectedHourData = ref<HourTableRow[]>([]);
const hourTableColumns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    required: true,
    sortable: true,
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    required: true,
    sortable: true,
  },
  {
    name: 'progress',
    label: 'Progress',
    field: 'progress',
    required: true,
    sortable: false,
  },
  {
    name: 'started',
    label: 'Started',
    field: 'started',
    required: true,
    sortable: true,
  },
  {
    name: 'ended',
    label: 'Ended',
    field: 'ended',
    required: true,
    sortable: true,
  },
  {
    name: 'duration',
    label: 'Duration (sec)',
    field: 'duration',
    required: true,
    sortable: true,
  },
];
const hourTableTitle = ref('Hour Details');

const editableRanges = computed({
  get: () => localEditableRanges.value,
  set: (val) => {
    localEditableRanges.value = val;
    heatmapSettingsStore.setSettings(settingsKey, {
      ranges: val,
      scaleToData: localScaleToData.value,
    });
  },
});

const scaleToData = computed({
  get: () => localScaleToData.value,
  set: (val) => {
    localScaleToData.value = val;
    heatmapSettingsStore.setSettings(settingsKey, {
      ranges: localEditableRanges.value,
      scaleToData: val,
    });
  },
});

function applyRanges() {
  if (!editableRanges.value || !Array.isArray(editableRanges.value) || editableRanges.value.length === 0) {
    console.warn('Cannot apply ranges: editableRanges is not properly initialized');
    return;
  }

  if (!chartSeries.value || !Array.isArray(chartSeries.value)) {
    console.warn('Cannot apply ranges: chartSeries is not properly initialized');
    return;
  }

  const newRanges: RangeSection[] = JSON.parse(
    JSON.stringify(editableRanges.value)
  );
  if (scaleToData.value) {
    const allData = chartSeries.value.flatMap((s: HeatmapSeries) =>
      s.data.map((d: HeatmapSeriesData) => d.y)
    );

    if (allData.length === 0) {
      console.warn('Cannot apply ranges: no chart data available');
      return;
    }

    if (newRanges.length < 4) {
      console.warn('Cannot apply ranges: editableRanges must have at least 4 elements');
      return;
    }
    
    let min = Math.min(...allData.filter((v: number) => v > 0));
    min = Math.max(min, 1);
    const max = Math.max(...allData);
    if (max < 4) {
      newRanges[0].from = 1;
      newRanges[0].to = 1;
      newRanges[1].from = 2;
      newRanges[1].to = 2;
      newRanges[2].from = 3;
      newRanges[2].to = 3;
      newRanges[3].from = 4;
      newRanges[3].to = Infinity;
    } else {
      const sectionCount = newRanges.length;
      const sectionSize = Math.floor((max - min + 1) / sectionCount);
      for (let idx = 0; idx < sectionCount; idx++) {
        newRanges[idx].from = min + idx * sectionSize;
        if (idx === sectionCount - 1) {
          newRanges[idx].to = max;
        } else {
          newRanges[idx].to = min + (idx + 1) * sectionSize - 1;
        }
      }
      newRanges[0].from = 1;
      if (newRanges[0].to < 1) newRanges[0].to = 1;
    }
  } else {
    newRanges.forEach((range: RangeSection, idx: number) => {
      if (idx === 0) {
        range.from = 1;
        if (range.to < 1) range.to = 1;
      } else {
        range.from = newRanges[idx - 1].to + 1;
      }
    });
  }
  localEditableRanges.value = newRanges;
  editableRanges.value = newRanges;
  emit('update:editableRanges', newRanges);
  heatmapSettingsStore.setSettings(settingsKey, {
    ranges: newRanges,
    scaleToData: scaleToData.value,
  });
}

const chartOptions = computed(() => ({
  chart: {
    height: 350,
    type: 'heatmap',
    background: 'transparent',
  },
  plotOptions: {
    heatmap: {
      shadeIntensity: 0.5,
      radius: 0,
      enableShades: true,
      colorScale: {
        ranges: [
          { from: 0, to: 0, name: 'no data', color: '#B0B0B0' },
          {
            from: 1,
            to: Math.max(props.editableRanges[0].to, 1),
            name: 'Low',
            color: '#4FC3F7',
          },
          {
            from: props.editableRanges[1].from,
            to: props.editableRanges[1].to,
            name: 'Medium',
            color: '#43A047',
          },
          {
            from: props.editableRanges[2].from,
            to: props.editableRanges[2].to,
            name: 'High',
            color: '#FFA500',
          },
          {
            from: props.editableRanges[3].from,
            to: props.editableRanges[3].to,
            name: 'Extreme',
            color: '#FF0000',
          },
        ],
      },
    },
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 1,
  },
  title: {
    text: `${selectedYear.value} HeatMap`,
    style: { color: modeColor.value },
  },
  xaxis: {
    tickPlacement: 'on',
    labels: {
      style: { colors: modeColor.value },
    },
  },
  yaxis: {
    labels: {
      style: { colors: modeColor.value },
    },
  },
  legend: {
    labels: {
      colors: modeColor.value,
    },
  },
  tooltip: {
    enabled: true,
    custom: function ({
      series,
      seriesIndex,
      dataPointIndex,
    }: {
      series: number[][];
      seriesIndex: number;
      dataPointIndex: number;
    }) {
      const value = series[seriesIndex][dataPointIndex];
      return `<div style='font-size:16px;padding:4px;color:#000;'>${
        value === 0 ? 'no data' : value
      }</div>`;
    },
  },
}));

watch(scaleToData, (val) => {
  if (val) {
    applyRanges();
  }
});

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

const effectiveYearOptions = computed(() => {
  if (!Array.isArray(props.yearOptions)) return [currentYear];
  return props.yearOptions.includes(currentYear)
    ? props.yearOptions
    : [currentYear, ...props.yearOptions];
});

const hasDataForCurrentYear = computed(() => {
  try {
    return (
      Array.isArray(props.rawHeatmapData) &&
      props.rawHeatmapData.some((r: HeatmapRow) => {
        const d = new Date(r.date);
        return d.getFullYear() === currentYear;
      })
    );
  } catch (e) {
    return false;
  }
});

const selectedYear = ref(
  Array.isArray(props.yearOptions) && props.yearOptions.includes(currentYear)
    ? currentYear
    : hasDataForCurrentYear.value
    ? currentYear
    : Array.isArray(props.yearOptions) && props.yearOptions.length
    ? props.yearOptions[0]
    : currentYear
);

const selectedMonth = ref(
  Array.isArray(props.monthNames) && props.monthNames[currentMonth]
    ? props.monthNames[currentMonth]
    : props.monthNames[0]
);

import { onMounted } from 'vue';
onMounted(() => {
  const saved = heatmapSettingsStore.getSettings(settingsKey);
  if (saved && Array.isArray(saved.ranges) && saved.ranges.length === 4) {
    localEditableRanges.value = JSON.parse(JSON.stringify(saved.ranges));
    if (typeof saved.scaleToData !== 'undefined') {
      localScaleToData.value = !!saved.scaleToData;
    }
    emit('update:editableRanges', localEditableRanges.value);
  } else {
    if (props.editableRanges && Array.isArray(props.editableRanges) && props.editableRanges.length >= 4) {
      localEditableRanges.value = JSON.parse(
        JSON.stringify(props.editableRanges)
      );
      localScaleToData.value = true;
      if (props.hasData && !props.loading) {
        applyRanges();
      }
    } else {
      localEditableRanges.value = [];
      localScaleToData.value = false;
    }
  }
});

function buildMonthChartSeries(monthIdx: number, year: number) {
  const monthRows: HeatmapRow[] = (props.rawHeatmapData || []).filter(
    (row: HeatmapRow) => {
      const dateObj = new Date(row.date);
      return dateObj.getMonth() === monthIdx && dateObj.getFullYear() === year;
    }
  );
  const dayMap: Record<number, Record<number, number>> = {};
  monthRows.forEach((row: HeatmapRow) => {
    const dateObj = new Date(row.date);
    const day = dateObj.getDate();
    const hour = Number(row.hour);
    const executions = Number(row.executions);
    if (!dayMap[day]) dayMap[day] = {};
    dayMap[day][hour] = executions;
  });
  const series: HeatmapSeries[] = Array.from({ length: 31 }, (_, dayIdx) => {
    const day = 31 - dayIdx;
    return {
      name: `${day}`,
      data: Array.from({ length: 24 }, (_, hour) => {
        const y = dayMap[day]?.[hour] ?? 0;
        return { x: `${hour}:00`, y };
      }),
    };
  });
  monthChartSeries.value = series;
}

function buildYearChartSeries(year: number) {
  const monthNames = props.monthNames;
  const byMonth: Record<string, Record<number, number>> = {};
  for (const m of monthNames) byMonth[m] = {};
  (props.rawHeatmapData || []).forEach((row: HeatmapRow) => {
    const dateObj = new Date(row.date);
    if (dateObj.getFullYear() !== year) return;
    const month = monthNames[dateObj.getMonth()];
    const day = dateObj.getDate();
    const executions = Number(row.executions);
    if (!byMonth[month][day]) byMonth[month][day] = 0;
    byMonth[month][day] += executions;
  });
  const series: HeatmapSeries[] = monthNames.map((month) => ({
    name: month,
    data: Array.from({ length: 31 }, (_, dayIdx) => {
      const day = dayIdx + 1;
      const y = byMonth[month][day] || 0;
      return { x: `${day}`, y };
    }),
  }));
  chartSeries.value = series;
}

buildYearChartSeries(selectedYear.value);

watch(
  [selectedMonth, selectedYear],
  ([newMonth, newYear], [oldMonth, oldYear]) => {
    if (showMonthView.value) {
      const monthIdx = props.monthNames.indexOf(newMonth);
      buildMonthChartSeries(monthIdx, newYear);
    }
  }
);

watch(selectedYear, (newYear) => {
  if (!showMonthView.value) {
    buildYearChartSeries(newYear);
  }
});

watch(() => props.hasData, (newHasData) => {
  if (newHasData && !props.loading) {
    try {
      buildYearChartSeries(selectedYear.value);
      if (showMonthView.value) {
        const monthIdx = props.monthNames.indexOf(selectedMonth.value);
        buildMonthChartSeries(monthIdx, selectedYear.value);
      }
    } catch (e) {
      console.warn('Error rebuilding heatmap series after data arrived', e);
    }

    if (localEditableRanges.value.length === 0) {
      if (props.editableRanges && Array.isArray(props.editableRanges) && props.editableRanges.length >= 4) {
        localEditableRanges.value = JSON.parse(JSON.stringify(props.editableRanges));
        localScaleToData.value = true;
        applyRanges();
      }
    } else if (scaleToData.value) {
      applyRanges();
    }
  }
});

function decrementMonth() {
  let monthIdx = props.monthNames.indexOf(selectedMonth.value);
  if (monthIdx === 0) {
    const yearIdx = effectiveYearOptions.value.indexOf(selectedYear.value);
      if (yearIdx < effectiveYearOptions.value.length - 1) {
        selectedYear.value = effectiveYearOptions.value[yearIdx + 1];
        selectedMonth.value = props.monthNames[11];
      }
  } else {
    selectedMonth.value = props.monthNames[monthIdx - 1];
  }
}

function incrementMonth() {
  let monthIdx = props.monthNames.indexOf(selectedMonth.value);
  if (monthIdx === 11) {
    const yearIdx = effectiveYearOptions.value.indexOf(selectedYear.value);
      if (yearIdx > 0) {
        selectedYear.value = effectiveYearOptions.value[yearIdx - 1];
        selectedMonth.value = props.monthNames[0];
      }
  } else {
    selectedMonth.value = props.monthNames[monthIdx + 1];
  }
}
function decrementYear() {
  const idx = effectiveYearOptions.value.indexOf(selectedYear.value);
  if (idx < effectiveYearOptions.value.length - 1) {
    selectedYear.value = effectiveYearOptions.value[idx + 1];
  }
}
function incrementYear() {
  const idx = effectiveYearOptions.value.indexOf(selectedYear.value);
  if (idx > 0) {
    selectedYear.value = effectiveYearOptions.value[idx - 1];
  }
}

const colorBarColors = [
  '#4FC3F7',
  '#43A047', 
  '#FFA500',
  '#FF0000',
];

const colorBarWidths = computed(() => {
  const ranges = editableRanges.value as RangeSection[];
  if (!ranges || ranges.length === 0) return [25, 25, 25, 25];
  const min = typeof ranges[0].from === 'number' ? ranges[0].from : 1;
  let max =
    typeof ranges[ranges.length - 1].to === 'number'
      ? ranges[ranges.length - 1].to
      : min + 3;
  if (!isFinite(max)) {
    max =
      typeof ranges[ranges.length - 2]?.to === 'number'
        ? ranges[ranges.length - 2].to + 1
        : min + 3;
  }
  const total = max - min + 1;
  if (!isFinite(total) || total <= 0) return [25, 25, 25, 25];
  let widths = [];
  let sum = 0;
  for (let idx = 0; idx < ranges.length - 1; idx++) {
    let rangeMax =
      typeof ranges[idx].to === 'number' ? ranges[idx].to : min + idx;
    const width = Math.round(((rangeMax - ranges[idx].from + 1) / total) * 100);
    widths.push(isFinite(width) && width > 0 ? width : 0);
    sum += widths[idx];
  }
  widths.push(Math.max(0, 100 - sum));
  return widths;
});

function handleBackToYearView() {
  const scrollY = window.scrollY;
  showMonthView.value = false;
  nextTick(() => {
    setTimeout(() => {
      window.scrollTo({ top: scrollY });
    }, 10);
  });
}

function goToCurrentYear() {
  selectedYear.value = currentYear;
}

function goToCurrentMonth() {
  selectedYear.value = currentYear;
  selectedMonth.value = props.monthNames[currentMonth];
}

function inspectTask(task: HourTableRow) {
  router.push(`/activity/tasks/${task.uuid}`);
}

function inspectInNewTab(task: HourTableRow) {
  const url = `/activity/tasks/${task.uuid}`;
  window.open(url, '_blank');
}
</script>

<style>
.heatmap-container {
  border-radius: 20px;
  padding: 30px;
  margin: 20px;
  position: relative;
}
.heatmap-header-bottom {
  position: absolute;
  left: 32px;
  bottom: 10px;
  display: flex;
  gap: 16px;
  z-index: 10;
}
.color-bar-container {
  margin-bottom: 16px;
}
.color-bar {
  display: flex;
  height: 18px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px #aaa;
}
.color-bar-section {
  height: 100%;
}
.color-bar-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}
.color-bar-label {
  font-size: 12px;
  color: #333;
  flex: 1;
  text-align: center;
}
.range-inputs-horizontal {
  display: flex;
  gap: 24px;
  justify-content: space-between;
  margin-top: 16px;
}
.range-input-horizontal {
  flex: 1;
  min-width: 120px;
}

.menu,
.apexcharts-menu {
  color: #333232 !important;
}
</style>
