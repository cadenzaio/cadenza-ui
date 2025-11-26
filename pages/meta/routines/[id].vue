<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }} {{ selectedItem?.version ? ` (v${selectedItem.version})` : '' }}
      </template>
      <div class="row q-mx-md">
        <FlowMap
          v-if="routineMap && routineMap.length > 0"
          :items="routineMap"
          id-field="name"
          label-field="label"
          previous-field="previousTaskExecutionName"
          @item-selected="onTaskSelected"
        />
        <InfoCard v-if="selectedItem">
          <template #title>
            {{ selectedItem?.name }}
          </template>
          <template #info>
            <div class="flex-column full-width">
              <div class="q-mx-md q-my-sm">
                Description: {{ selectedItem?.description }}
              </div>
                            <div
                class="q-mx-md q-my-sm"
                @click="
                  navigateToItem(`/system/services/${selectedItem?.service}`)
                "
                @contextmenu.prevent="
                  openLinkInNewTab(
                    `/services/${selectedItem?.service}`
                  )
                "
              >
              Service:
                <span class="text-primary cursor-pointer">{{
                  selectedItem?.service
                }}</span>
              </div>
              <div class="q-separator" style="height: 2px"></div>
              <div class="q-mx-md q-my-sm">Name: {{ selectedItem?.name }}</div>
              <div
                class="q-mx-md q-my-sm"
                @click="
                  navigateToItem(`/services/${selectedItem?.service_instance}`)
                "
                @contextmenu.prevent="
                  openLinkInNewTab(
                    `/services/${selectedItem?.service_instance}`
                  )
                "
              >
                <span class="text-primary cursor-pointer">
                  {{ selectedItem?.serviceName }}
                </span>
              </div>
              <div class="q-mx-md q-my-sm">
                Created:
                {{
                  selectedItem?.created
                    ? new Date(selectedItem.created).toLocaleString()
                    : 'N/A'
                }}
              </div>
              <div class="q-mx-md q-my-sm">
                Deleted: {{ selectedItem?.deleted ? 'Yes' : 'No' }}
              </div>
            </div>
          </template>
        </InfoCard>
        <ExecutionStatisticsPieChart
          type="routine"
          :routineName="String(route.params.id)"
        />
        <ExecutionTimeChart v-if="selectedItem" :series="executionTimeSeries" />
        <Table
          class="custom-table"
          :columns="columns"
          :rows="routines"
          row-key="name"
          @inspect-row="inspectRoutine"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreRoutines"
          style="z-index: 1"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        >
          <template #title> Active Executions </template>
        </Table>
      </div>
      <HeatMap
        v-if="heatmapData"
        :chartSeries="heatmapData.chartSeries"
        :yearOptions="heatmapData.yearOptions"
        :monthNames="heatmapData.monthNames"
        :editableRanges="heatmapData.editableRanges"
        :rawHeatmapData="heatmapData.rawData"
        @update:editableRanges="
          (val) => {
            if (heatmapData) heatmapData.editableRanges = val;
          }
        "
      />
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useFetch, useRoute, useRouter } from '#app';
import { useAppStore } from '~/stores/app';
import InfoCard from '~/components/InfoCard.vue';
import FlowMap from '~/components/FlowMap.vue';
// import HeatMap from '~/components/HeatMap.vue';
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

interface Item {
  type: string;
  name: string;
  description: string;
  function_string: string;
  executionName: any;
  progress: any;
  service_instance: string;
  created: string;
  deleted: boolean;
  service: string;
  serviceName?: string;
  version?: string | number;
}

interface ExecutionTime {
  date: any;
  hour: number;
  executions: number;
  total_execution_time: number;
  slowest_time: number;
  fastest_time: number;
  average_time: number;
}

const layout = 'dashboard-layout';
const selectedItem = ref<Item | null>(null);
const executionTimeSeries = ref<{ name: string; data: [number, number][] }[]>(
  []
);
const route = useRoute();
interface HeatmapData {
  chartSeries: any[];
  yearOptions: number[];
  monthNames: string[];
  editableRanges: { from: number; to: number }[];
  rawData: any[];
}

const heatmapData = ref<HeatmapData | null>(null);

// Fetch meta routine definitions (returns list). We'll normalize lookup by name/label/uuid later.
const { data: Items, error } = await useFetch<Item[]>(`/api/meta/routines/metaRoutines`);
if (error.value) {
  console.error('Error fetching Items:', error.value);
}

// Fetch the execution times chart series data
const { data: executionData, error: executionError } = await useFetch(
  `/api/activity/routines/routineExecutionTimes?routineName=${route.params.id}`
);
if (executionError.value) {
  console.error('Error fetching execution times:', executionError.value);
} else if (
  executionData.value &&
  'series' in executionData.value &&
  Array.isArray(executionData.value.series)
) {
  executionTimeSeries.value = executionData.value.series.map((series: any) => ({
    name: series.name,
    data: Array.isArray(series.data)
      ? series.data
          .filter(
            (d: any) =>
              Array.isArray(d) &&
              d.length === 2 &&
              typeof d[1] === 'number' &&
              (typeof d[0] === 'number' || typeof d[0] === 'string') &&
              !(typeof d[0] === 'string' && Number.isNaN(Date.parse(d[0])))
          )
          .map((d: any) => {
            const ts = typeof d[0] === 'number' ? d[0] : Date.parse(d[0]);
            return [ts, d[1]];
          })
      : [],
  }));
}

interface Routine {
  uuid: string;
  name: string;
  type: string;
  label: string;
  description: string;
  routineDescription: string;
  serviceName: string;
  status: string;
  previousRoutineExecution: string;
  progress: number;
  started: string;
  ended: string;
  duration: string;
  previousRoutineName: string;
  traceId: string;
  serviceInstance: string;
  inputContext: any;
  outputContext: any;
  isRunning: boolean;
  referer: string | null;
  routineId: string;
}

const selectedRoutine = ref<Routine[] | undefined>(undefined);

interface RoutineMapTask {
  name: any;
  label: any;
  layer_index: any;
  previousTaskExecutionName: any;
  description: any;
  is_unique: any;
  concurrency: any;
}

const routineMap = ref<(RoutineMapTask & { name: any })[]>([]);

const columns = [
  {
    name: 'label',
    label: 'Name',
    field: 'label',
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
];

const routines = ref<Routine[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;

const router = useRouter();

function inspectRoutine(routine: Routine) {
  navigateToItem(`/activity/routines/${routine.routineId}`);
}

function inspectInNewTab(routine: Routine) {
  openLinkInNewTab(`/activity/routines/${routine.routineId}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

function onTaskSelected(task: any) {
  console.log('Task selected:', task);
  if (task && task.name) {
    const path = `/meta/tasks/${encodeURIComponent(String(task.name))}`;
    const qs: string[] = [];
    const version = (task as any).version ?? (task as any).task_version ?? null;
    const service = (task as any).service ?? (task as any).service_name ?? (task as any).serviceName ?? null;
    if (version) qs.push(`version=${encodeURIComponent(String(version))}`);
    if (service) qs.push(`service=${encodeURIComponent(String(service))}`);
    navigateToItem(qs.length > 0 ? `${path}?${qs.join('&')}` : path);
  }
}

async function fetchHeatmapData(routineName: string) {
  try {
    const response = await fetch(
      `/api/services/routines/heatmapData?routineName=${routineName}`
    );
    const rawData = await response.json();
    const dates = rawData.map((r: any) => new Date(r.date));
    const years = Array.from(
      new Set<number>(dates.map((d: Date) => d.getFullYear()))
    ).sort((a: number, b: number) => b - a);
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const editableRanges = [
      { from: 1, to: 10 },
      { from: 11, to: 20 },
      { from: 21, to: 30 },
      { from: 31, to: 40 },
    ];
    heatmapData.value = {
      chartSeries: [],
      yearOptions: years,
      monthNames,
      editableRanges,
      rawData,
    };
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    heatmapData.value = null;
  }
}

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');

  const itemName: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;

  if (Items.value && Array.isArray(Items.value)) {
    const found = Items.value.find(
      (item: any) =>
        item.name === itemName || item.label === itemName || item.uuid === itemName
    ) as any;
    if (found) {
      // Ensure `name` property exists for compatibility with other codepaths
      if (!found.name && found.label) found.name = found.label;
      selectedItem.value = found;
    } else {
      selectedItem.value = null;
    }
  }

  // Apply query overrides (version/service) when present in the URL
  const qVersion = route.query.version ?? route.query.v ?? null;
  const qService = route.query.service ?? route.query.s ?? null;
  if (selectedItem.value) {
    if (qVersion) (selectedItem.value as any).version = String(qVersion);
    if (qService) selectedItem.value.service = String(qService);
  }

  fetchActiveRoutines(itemName, false);

  // Fetch routine map data
  if (selectedItem.value) {
    try {
      const tasks = await $fetch<any>(
        `/api/services/tasks/staticTasksInRoutine?routineName=${selectedItem.value.name}`
      );
      routineMap.value = Array.isArray(tasks)
        ? tasks.map((task: any) => ({
            ...task,
            name: task.name, // Add 'name' property required by FlowItem
          }))
        : [];
    } catch (error) {
      console.error('Error fetching routine map:', error);
      routineMap.value = [];
    }
  }

  fetchHeatmapData(
    Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  );
});

watch(
  () => route.params.id,
  async (newId) => {
    const itemName: string = Array.isArray(newId) ? newId[0] : newId;

    if (Items.value && Array.isArray(Items.value)) {
      const found = (Items.value as any[]).find(
        (item: any) => item.name === itemName || item.label === itemName || item.uuid === itemName
      ) as any;
      if (found) {
        if (!found.name && found.label) found.name = found.label;
        selectedItem.value = found;
      } else {
        selectedItem.value = null;
      }

      // Apply query overrides (version/service) when present in the URL
      const qVersion = route.query.version ?? route.query.v ?? null;
      const qService = route.query.service ?? route.query.s ?? null;
      if (selectedItem.value) {
        if (qVersion) (selectedItem.value as any).version = String(qVersion);
        if (qService) selectedItem.value.service = String(qService);
      }
    } else {
      selectedItem.value = null;
    }

    fetchActiveRoutines(itemName, false);

    // Re-fetch routine map for the newly-selected routine
    if (selectedItem.value) {
      try {
        const tasks = await $fetch<any>(
          `/api/services/tasks/staticTasksInRoutine?routineName=${selectedItem.value.name}`
        );
        routineMap.value = Array.isArray(tasks)
          ? tasks.map((task: any) => ({
              ...task,
              name: task.name,
            }))
          : [];
      } catch (error) {
        console.error('Error fetching routine map:', error);
        routineMap.value = [];
      }
    } else {
      routineMap.value = [];
    }

    fetchHeatmapData(itemName);
  }
);

async function fetchActiveRoutines(itemName: string, isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const data = await $fetch<any>(
      `/api/activity/routines/routineActivity?name=${itemName}&page=${currentPage.value}&limit=${pageSize}`
    );

    const normalized: Routine[] = Array.isArray(data) ? data : data ? [data] : [];

    if (isLoadMore) {
      routines.value = [...routines.value, ...normalized];
    } else {
      routines.value = normalized;
    }

    hasMoreData.value = normalized.length === pageSize;
  } catch (error) {
    console.error('Error fetching active routines:', error);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
}

async function loadMoreRoutines() {
  const itemName: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  await fetchActiveRoutines(itemName, true);
}
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
