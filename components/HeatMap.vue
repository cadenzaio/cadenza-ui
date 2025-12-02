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
        </div>
      </div>
      <div v-show="showMonthView">
        <apexchart
          type="heatmap"
          height="500"
          :options="monthChartOptions"
          :series="monthChartSeries"
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
</template>

<script setup lang="ts">
// Types
import { defineProps, defineEmits } from 'vue';
interface RangeSection {
  from: number;
  to: number;
}
// Heatmap data row from API
interface HeatmapRow {
  date: string; // ISO date string
  hour: number;
  executions: number;
  [key: string]: unknown;
}
// ApexCharts heatmap series data
interface HeatmapSeriesData {
  x: string;
  y: number;
}
interface HeatmapSeries {
  name: string;
  data: HeatmapSeriesData[];
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

// Pinia store for heatmap settings
const heatmapSettingsStore = useHeatmapSettingsStore();

// Local state for settings
const localEditableRanges = ref<RangeSection[]>([]);
const localScaleToData = ref(false);
const settingsKey = 'default'; // You can make this dynamic if needed

// Month heatmap data and options

// Use prop for monthChartSeries

function getMonthColorScaleRanges() {
  const ranges = props.editableRanges as RangeSection[];
  // Always ensure 'Low' starts at 1
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

// Remove generateMonthData, use prop

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
  // config contains seriesIndex (month), dataPointIndex (day-1)
  if (
    config &&
    typeof config.seriesIndex === 'number' &&
    typeof config.dataPointIndex === 'number'
  ) {
    const monthIdx = config.seriesIndex;
    const month = props.monthNames[monthIdx];
    selectedMonth.value = month;
    selectedMonthIndex.value = monthIdx;
    selectedYear.value = currentYear; // Default to current year on click
    buildMonthChartSeries(monthIdx, selectedYear.value);
    // Save scroll position and restore after DOM updates (with delay)
    const scrollY = window.scrollY;
    showMonthView.value = true;
    nextTick(() => {
      setTimeout(() => {
        window.scrollTo({ top: scrollY });
      }, 10);
    });
  }
}
import VueApexCharts from 'vue3-apexcharts';
import { ref, computed, watch, nextTick } from 'vue';
import { useAppStore } from '@/stores/app';
import { storeToRefs } from 'pinia';
import { ref as qRef } from 'vue';

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

// Handle max value change for a section, update min for next section, and enforce non-overlapping
function handleMaxChange(val: number, idx: number) {
  if (scaleToData.value) scaleToData.value = false;
  // Work on a copy to avoid mutating prop directly
  const newRanges = props.editableRanges.map((r) => ({ ...r }));
  // Always clamp the first range's from to 1
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
// Use prop for chartSeries

// Use app store for dark mode
const appStore = useAppStore();
const { isDarkMode } = storeToRefs(appStore);

const getLabelColor = () => (isDarkMode.value ? '#e0e0e0' : '#20242c');

const labelStyle = {
  color: getLabelColor(),
};

const showDialog = qRef(false);

// Use Pinia store for editableRanges and scaleToData
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
  // Safety check: Don't apply ranges if there's no data or ranges are not initialized
  if (!editableRanges.value || !Array.isArray(editableRanges.value) || editableRanges.value.length === 0) {
    console.warn('Cannot apply ranges: editableRanges is not properly initialized');
    return;
  }
  
  // Additional safety check for chartSeries
  if (!chartSeries.value || !Array.isArray(chartSeries.value)) {
    console.warn('Cannot apply ranges: chartSeries is not properly initialized');
    return;
  }
  
  // Copy to avoid mutating prop directly
  const newRanges: RangeSection[] = JSON.parse(
    JSON.stringify(editableRanges.value)
  );
  if (scaleToData.value) {
    const allData = chartSeries.value.flatMap((s: HeatmapSeries) =>
      s.data.map((d: HeatmapSeriesData) => d.y)
    );
    
    // Safety check: ensure we have data to work with
    if (allData.length === 0) {
      console.warn('Cannot apply ranges: no chart data available');
      return;
    }
    
    // Safety check: ensure newRanges has the expected structure
    if (newRanges.length < 4) {
      console.warn('Cannot apply ranges: editableRanges must have at least 4 elements');
      return;
    }
    
    let min = Math.min(...allData.filter((v: number) => v > 0));
    min = Math.max(min, 1); // Clamp min to at least 1
    const max = Math.max(...allData);
    if (max < 4) {
      // Set ranges as: low 1-1, medium 2-2, high 3-3, extreme 4-infinity
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
      // Ensure first range starts at 1
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
  // Save to Pinia store on OK
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
          { from: 0, to: 0, name: 'no data', color: '#B0B0B0' }, // grey for no data
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
    // When toggled on, update editableRanges to scale to data
    applyRanges();
  }
});

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth(); // 0-based

// Ensure we always have the current year available in the options shown to the user
const effectiveYearOptions = computed(() => {
  if (!Array.isArray(props.yearOptions)) return [currentYear];
  return props.yearOptions.includes(currentYear)
    ? props.yearOptions
    : [currentYear, ...props.yearOptions];
});

// Prefer current year when it's in options or when we actually have data for it;
// otherwise fall back to the first provided option (or currentYear as a final fallback).
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

// Default selected month should be the current month name when available
const selectedMonth = ref(
  Array.isArray(props.monthNames) && props.monthNames[currentMonth]
    ? props.monthNames[currentMonth]
    : props.monthNames[0]
);

// On mount, load settings from store or use scale-to-data
import { onMounted } from 'vue';
onMounted(() => {
  const saved = heatmapSettingsStore.getSettings(settingsKey);
  if (saved && Array.isArray(saved.ranges) && saved.ranges.length === 4) {
    localEditableRanges.value = JSON.parse(JSON.stringify(saved.ranges));
    if (typeof saved.scaleToData !== 'undefined') {
      localScaleToData.value = !!saved.scaleToData;
    }
    // Emit to parent so prop is updated and chart reflects store
    emit('update:editableRanges', localEditableRanges.value);
  } else {
    // No settings: enable scaleToData, apply scaling, and save
    // But only if we have valid data to work with
    if (props.editableRanges && Array.isArray(props.editableRanges) && props.editableRanges.length >= 4) {
      localEditableRanges.value = JSON.parse(
        JSON.stringify(props.editableRanges)
      );
      localScaleToData.value = true;
      // Apply scaling and save as initial settings only if we have data
      if (props.hasData && !props.loading) {
        applyRanges();
      }
    } else {
      // Initialize with empty array if no valid ranges provided
      localEditableRanges.value = [];
      localScaleToData.value = false;
    }
  }
});

function buildMonthChartSeries(monthIdx: number, year: number) {
  // Filter rawHeatmapData for this month and year
  const monthRows: HeatmapRow[] = (props.rawHeatmapData || []).filter(
    (row: HeatmapRow) => {
      const dateObj = new Date(row.date);
      return dateObj.getMonth() === monthIdx && dateObj.getFullYear() === year;
    }
  );
  // Build: [{ name: day, data: [{ x: hour, y }] }]
  const dayMap: Record<number, Record<number, number>> = {};
  monthRows.forEach((row: HeatmapRow) => {
    const dateObj = new Date(row.date);
    const day = dateObj.getDate();
    const hour = Number(row.hour);
    const executions = Number(row.executions);
    if (!dayMap[day]) dayMap[day] = {};
    dayMap[day][hour] = executions;
  });
  // 31 days, 24 hours
  const series: HeatmapSeries[] = Array.from({ length: 31 }, (_, dayIdx) => {
    const day = 31 - dayIdx; // y-axis: Day 31 at top
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

// Build chartSeries for the selected year
function buildYearChartSeries(year: number) {
  const monthNames = props.monthNames;
  // Build a lookup: month -> day (1-31) -> executions sum for that day
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
  // For each month, build 31 days
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

// On mount, build initial year chart
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

// Watch for hasData changes to initialize ranges when data becomes available
watch(() => props.hasData, (newHasData) => {
  if (newHasData && !props.loading) {
    // First: rebuild the charts so chartSeries is populated for scaling
    try {
      buildYearChartSeries(selectedYear.value);
      if (showMonthView.value) {
        const monthIdx = props.monthNames.indexOf(selectedMonth.value);
        buildMonthChartSeries(monthIdx, selectedYear.value);
      }
    } catch (e) {
      console.warn('Error rebuilding heatmap series after data arrived', e);
    }

    // Then initialize ranges if needed and apply scaling now that data exists
    if (localEditableRanges.value.length === 0) {
      if (props.editableRanges && Array.isArray(props.editableRanges) && props.editableRanges.length >= 4) {
        localEditableRanges.value = JSON.parse(JSON.stringify(props.editableRanges));
        localScaleToData.value = true;
        // applyRanges relies on chartSeries being populated, so call it after rebuild
        applyRanges();
      }
    } else if (scaleToData.value) {
      // If scale-to-data was already enabled, re-apply to reflect the newly-arrived data
      applyRanges();
    }
  }
});

function decrementMonth() {
  let monthIdx = props.monthNames.indexOf(selectedMonth.value);
  if (monthIdx === 0) {
    // Go to December of previous year
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
    // Go to January of next year
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

// Color bar logic for dialog
const colorBarColors = [
  '#4FC3F7', // Low
  '#43A047', // Medium
  '#FFA500', // High
  '#FF0000', // Extreme
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
  // Calculate widths for first 3 sections
  let widths = [];
  let sum = 0;
  for (let idx = 0; idx < ranges.length - 1; idx++) {
    let rangeMax =
      typeof ranges[idx].to === 'number' ? ranges[idx].to : min + idx;
    const width = Math.round(((rangeMax - ranges[idx].from + 1) / total) * 100);
    widths.push(isFinite(width) && width > 0 ? width : 0);
    sum += widths[idx];
  }
  // Last section fills the rest
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
