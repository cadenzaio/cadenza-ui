<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }}
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
              <div class="q-mx-md q-my-sm">
                Function: {{ selectedItem?.function_string }}
              </div>
              <div class="q-separator" style="height: 2px"></div>
              <div class="q-mx-md q-my-sm">Name: {{ selectedItem?.name }}</div>
              <div class="q-mx-md q-my-sm">Type: {{ selectedItem?.type }}</div>
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
                  {{ selectedItem?.service_instance }}
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
import HeatMap from '~/components/HeatMap.vue';
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

const { data: Items, error } = await useFetch<Item[]>(
  `/api/services/routines/${route.params.id}`
);
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
              typeof d[0] === 'number' &&
              typeof d[1] === 'number'
          )
          .map((d: any) => [d[0], d[1]])
      : [],
  }));
}

interface Routine {
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
  // Left click: navigate, right click: open in new tab
  // (Assume this is called from a row or button, so add @contextmenu in template where used)
  navigateToItem(`/activity/routines/${routine.name}`);
}

function inspectInNewTab(routine: Routine) {
  openLinkInNewTab(`/activity/routines/${routine.name}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

function onTaskSelected(task: any) {
  console.log('Task selected:', task);
  if (task.name) {
    // Left click: navigate, right click: open in new tab
    // (Assume this is called from a row or button, so add @contextmenu in template where used)
    navigateToItem(`/system/tasks/${task.name}`);
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
  appStore.setCurrentSection('system');

  const itemName: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;

  if (Items.value && Array.isArray(Items.value)) {
    selectedItem.value =
      (Items.value.find((item) => item.name === itemName) as Item) ?? null;
  }

  fetchActiveRoutines(itemName, false);

  // Fetch routine map data
      if (selectedItem.value) {
    try {
      const tasks = await $fetch(
        `/api/services/tasks/staticTasksInRoutine?routineName=${selectedItem.value.name}`
      );
      routineMap.value =
        (tasks as RoutineMapTask[]).map((task) => ({
          ...task,
              name: task.name, // Add 'name' property required by FlowItem
        })) || [];
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
  (newId) => {
    fetchHeatmapData(Array.isArray(newId) ? newId[0] : newId);
  }
);

async function fetchActiveRoutines(itemName: string, isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const data = await $fetch<Routine[]>(
      `/api/activity/routines/routineActivity?id=${itemName}&page=${currentPage.value}&limit=${pageSize}`
    );

    if (isLoadMore) {
      routines.value = [...routines.value, ...(data || [])];
    } else {
      routines.value = data || [];
    }

    hasMoreData.value = (data || []).length === pageSize;
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
