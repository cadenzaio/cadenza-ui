<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }} - {{ selectedItem?.uuid.slice(0, 8) }}
      </template>
      <div class="row q-mx-md">
        <FlowMap
          v-if="routineMap && routineMap.length > 0"
          :items="routineMap"
          id-field="uuid"
          label-field="label"
          previous-field="previousTaskExecutionId"
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
              <div class="q-mx-md q-my-sm">UUID: {{ selectedItem?.uuid }}</div>
              <div class="q-mx-md q-my-sm">Type: {{ selectedItem?.type }}</div>
              <div
                class="q-mx-md q-my-sm"
                @click="
                  navigateToItem(`/services/${selectedItem?.processing_graph}`)
                "
                @contextmenu.prevent="
                  openLinkInNewTab(
                    `/services/${selectedItem?.processing_graph}`
                  )
                "
              >
                <span class="text-primary cursor-pointer">
                  {{ selectedItem?.processing_graph }}
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
          :routineId="String(route.params.id)"
        />
        <ExecutionTimeChart v-if="selectedItem" :series="executionTimeSeries" />
        <Table
          class="custom-table"
          :columns="columns"
          :rows="routines"
          row-key="id"
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
  id: any;
  executionId: any;
  progress: any;
  uuid: any;
  routine_id: any;
  processing_graph: string;
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
const executionTimeSeries = ref<
  { name: string; data: (string | number)[][] }[]
>([]);
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
  `/api/activity/routines/routineExecutionTimes?routineId=${route.params.id}`
);
if (executionError.value) {
  console.error('Error fetching execution times:', executionError.value);
} else if (
  executionData.value &&
  'series' in executionData.value &&
  Array.isArray(executionData.value.series)
) {
  executionTimeSeries.value = executionData.value.series;
}

interface Routine {
  id: string;
  name: string;
  type: string;
  label: string;
  description: string;
  routineDescription: string;
  serverId: string;
  routineId: string;
  status: string;
  previousRoutineExecution: string;
  progress: number;
  started: string;
  ended: string;
  duration: string;
  uuid: string;
  serverName: string;
  previousRoutineName: string;
  contract_id: string;
  processingGraph: string;
  inputContext: any;
  outputContext: any;
  isRunning: boolean;
  referer: string | null;
}

const selectedRoutine = ref<Routine[] | undefined>(undefined);

interface RoutineMapTask {
  uuid: any;
  label: any;
  layer_index: any;
  previousTaskExecutionId: any;
  description: any;
  is_unique: any;
  concurrency: any;
}

const routineMap = ref<(RoutineMapTask & { id: any })[]>([]);

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
  navigateToItem(`/activity/routines/${routine.id}`);
}

function inspectInNewTab(routine: Routine) {
  openLinkInNewTab(`/activity/routines/${routine.id}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

function onTaskSelected(task: any) {
  console.log('Task selected:', task);
  if (task.uuid) {
    // Left click: navigate, right click: open in new tab
    // (Assume this is called from a row or button, so add @contextmenu in template where used)
    navigateToItem(`/services/tasks/${task.uuid}`);
  }
}

async function fetchHeatmapData(routineId: string) {
  try {
    const response = await fetch(
      `/api/services/routines/heatmapData?routineId=${routineId}`
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
  appStore.setCurrentSection('services');

  const itemId: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;

  if (Items.value && Array.isArray(Items.value)) {
    selectedItem.value =
      (Items.value.find((item) => item.uuid === itemId) as Item) ?? null;
  }

  fetchActiveRoutines(itemId, false);

  // Fetch routine map data
  if (selectedItem.value) {
    try {
      const tasks = await $fetch(
        `/api/services/tasks/staticTasksInRoutine?routineId=${selectedItem.value.uuid}`
      );
      routineMap.value =
        (tasks as RoutineMapTask[]).map((task) => ({
          ...task,
          id: task.uuid, // Add 'id' property required by FlowItem
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

async function fetchActiveRoutines(itemId: string, isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const data = await $fetch<Routine[]>(
      `/api/activity/routines/routineActivity?id=${itemId}&page=${currentPage.value}&limit=${pageSize}`
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
  const itemId: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  await fetchActiveRoutines(itemId, true);
}
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
