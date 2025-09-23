<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }} - {{ selectedItem?.uuid.slice(0, 8) }}
      </template>
      <div class="row q-mx-md">
        <FlowMap
          v-if="taskMap && taskMap.length > 0"
          :items="taskMap"
          id-field="uuid"
          label-field="name"
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
              <div class="q-separator" style="height: 2px"></div>
              <div class="q-mx-md q-my-sm">UUID: {{ selectedItem?.uuid }}</div>
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
                <span class="text-primary cursor-pointer">{{
                  selectedItem?.processing_graph
                }}</span>
              </div>
              <div class="q-mx-md q-my-sm">
                Created: {{ new Date(selectedItem?.created).toLocaleString() }}
              </div>
              <div class="q-mx-md q-my-sm">
                Deleted: {{ selectedItem?.deleted ? 'Yes' : 'No' }}
              </div>
              <div class="q-mx-md q-my-sm">
                Is Unique: {{ selectedItem?.is_unique ? 'Yes' : 'No' }}
              </div>
              <div class="q-mx-md q-my-sm">
                Concurrency: {{ selectedItem?.concurrency }}
              </div>
            </div>
          </template>
        </InfoCard>
        <InfoCard>
          <template #title> Tasks Function </template>
          <template #info class="overflow-auto">
            <pre>{{ selectedItem?.function_string }}</pre>
          </template>
        </InfoCard>
        <ExecutionStatisticsPieChart
          :type="'task'"
          :taskId="String(route.params.id)"
        />
        <ExecutionTimeChart :series="executionTimeSeries" />
        <Table
          class="custom-table"
          :columns="columns"
          :rows="tasks"
          row-key="uuid"
          @inspect-row="inspectTask"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreTasks"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreTasksData"
          :loadingMoreData="loadingMoreTasksData"
        >
          <template #title> Active Executions </template>
        </Table>
        <Table
          :columns="columns2"
          :rows="routines"
          row-key="uuid"
          @inspect-row="inspectRoutine"
          @inspect-row-in-new-tab="inspectRoutineInNewTab"
          @loadMoreData="loadMoreRoutines"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreRoutinesData"
          :loadingMoreData="loadingMoreRoutinesData"
        >
          <template #title> Routines Using This Task </template>
        </Table>
      </div>
      <HeatMap
        v-if="heatmapData"
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
import { computedAsync } from '@vueuse/core';
import InfoCard from '~/components/InfoCard.vue';
import FlowMap from '~/components/FlowMap.vue';
import HeatMap from '~/components/HeatMap.vue';

// Define the Item interface
interface Item {
  taskId: string;
  type: string;
  name: string;
  description: string;
  function_string: string;
  id: any;
  executionId: any;
  progress: any;
  uuid: any;
  processing_graph: string;
  created: string;
  deleted: boolean;
  is_unique: boolean;
  concurrency: number;
}

interface ExecutionTime {
  date: string;
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
  { name: string; data: { x: string | number | Date; y: number }[] }[]
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

// Fetch the Items data
const { data: Items, error } = await useFetch(
  `/api/services/tasks/${route.params.id}`
);

// Error handling
if (error.value) {
  console.error('Error fetching Items:', error.value);
}

// Fetch the execution times chart series data
const { data: executionData, error: executionError } = await useFetch(
  `/api/activity/tasks/taskExecutionTimes?taskId=${route.params.id}`
);
if (executionError.value) {
  console.error('Error fetching execution times:', executionError.value);
} else if (
  executionData.value &&
  !('error' in executionData.value) &&
  executionData.value.series
) {
  // Convert each series' data to the correct format
  executionTimeSeries.value = executionData.value.series.map(
    (series: { name: string; data: (string | number)[][] }) => ({
      name: series.name,
      data: Array.isArray(series.data)
        ? series.data
            .filter(
              (point: (string | number)[]) =>
                Array.isArray(point) &&
                point.length === 2 &&
                typeof point[1] === 'number'
            )
            .map((point: (string | number)[]) => ({
              x: point[0],
              y: point[1] as number,
            }))
        : [],
    })
  );
}

interface Task {
  type: string;
  label: string;
  description: string;
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

interface Routine {
  type: string;
  label: string;
  description: string;
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

const selectedTask = ref<Task[] | undefined>(undefined);

const columns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
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
const columns2 = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    required: true,
    sortable: true,
  },
];

const tasks = ref<any[]>([]);
const routines = ref<any[]>([]);

// Task map for FlowMap - shows static task flow within a routine (service view)
const taskMap = ref<any[]>([]);

async function updateTaskMap() {
  if (!selectedItem.value || !routines.value || routines.value.length === 0) {
    taskMap.value = [];
    return;
  }
  try {
    const firstRoutine = routines.value[0];
    const response = await $fetch(
      `/api/services/tasks/staticTasksInRoutine?routineId=${firstRoutine.uuid}`
    );
    const itemsArray = Array.isArray(response) ? response : [];
    // Set isSelected on the correct node (by uuid or taskId)
    taskMap.value = itemsArray.map((item: any) => ({
      ...item,
      isSelected:
        selectedItem.value &&
        (item.taskId === selectedItem.value.uuid ||
          item.uuid === selectedItem.value.uuid),
    }));
  } catch (error) {
    console.error('Error fetching task map:', error);
    taskMap.value = [];
  }
}

watch([selectedItem, routines], updateTaskMap, { immediate: true });

function onTaskSelected(task: any) {
  console.log('Task selected:', task);
  if (task.uuid) {
    navigateToItem(`/services/tasks/${task.uuid}`);
  }
}

const hasMoreTasksData = ref(true);
const loadingMoreTasksData = ref(false);
const tasksCurrentPage = ref(1);
const hasMoreRoutinesData = ref(true);
const loadingMoreRoutinesData = ref(false);
const routinesCurrentPage = ref(1);
const pageSize = 50;

const router = useRouter();

function inspectTask(task: Task) {
  navigateToItem(`/activity/tasks/${task.uuid}`);
}

import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(task: Task) {
  openLinkInNewTab(`/activity/tasks/${task.uuid}`);
}

function inspectRoutine(routine: Routine) {
  navigateToItem(`/services/routines/${routine.uuid}`);
}

function inspectRoutineInNewTab(routine: Routine) {
  openLinkInNewTab(`/services/routines/${routine.uuid}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('system');

  tasksCurrentPage.value = 1; // Always start at page 1 for tasks
  routinesCurrentPage.value = 1; // Always start at page 1 for routines

  const itemId: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  if (Array.isArray(Items.value)) {
    selectedItem.value = Items.value.find((item: Item) => item.uuid === itemId);
  } else {
    selectedItem.value = null;
  }
  fetchActiveTasks(itemId, false);
  fetchRoutinesUsingTask(itemId, false);
  fetchHeatmapData(itemId);
});

const taskId = route.params.id;

async function fetchActiveTasks(taskId: string, isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreTasksData.value = true;
      tasksCurrentPage.value++;
    }

    console.log(
      `Fetching active tasks for itemId: ${taskId}, page: ${tasksCurrentPage.value}`
    );
    const response = await fetch(
      `/api/activity/tasks/activeTasks${
        taskId
          ? `?id=${taskId}&page=${tasksCurrentPage.value}&limit=${pageSize}`
          : ''
      }`,
      { method: 'GET' }
    );
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      throw new Error('Failed to parse JSON response');
    }

    console.log('Response data:', data);

    let taskArray = [];
    if (Array.isArray(data)) {
      taskArray = data;
    } else if (data && Array.isArray(data.tasks)) {
      taskArray = data.tasks;
    } else if (data && data.tasks) {
      taskArray = [data.tasks];
    } else if (data) {
      taskArray = [data];
    }

    console.log('taskArray:', taskArray);
    if (taskArray.length > 0) {
      console.log('First task object:', taskArray[0]);
    }

    if (isLoadMore) {
      tasks.value = [...tasks.value, ...taskArray];
    } else {
      tasks.value = taskArray;
    }

    hasMoreTasksData.value = taskArray.length === pageSize;
    console.log('tasks.value:', tasks.value);
  } catch (error) {
    console.error('Error loading tasks:', error);
    hasMoreTasksData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreTasksData.value = false;
    }
  }
}

async function fetchRoutinesUsingTask(taskId: string, isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreRoutinesData.value = true;
      routinesCurrentPage.value++;
    }

    const response = await fetch(
      `/api/services/routines/routinesWithTask?taskId=${taskId}&page=${routinesCurrentPage.value}&limit=${pageSize}`
    );
    const data = await response.json();

    if (isLoadMore) {
      routines.value = [...routines.value, ...data];
    } else {
      routines.value = data;
    }

    hasMoreRoutinesData.value = data.length === pageSize;
  } catch (error) {
    console.error('Error fetching routines:', error);
    hasMoreRoutinesData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreRoutinesData.value = false;
    }
  }
}

async function fetchHeatmapData(taskId: string) {
  try {
    const response = await fetch(
      `/api/services/tasks/heatmapData?taskId=${taskId}`
    );
    const rawData = await response.json();
    // Build yearOptions and monthNames from rawData
    const dates = rawData.map((r: any) => new Date(r.date));
    const years = Array.from(
      new Set<number>(dates.map((d: any) => d.getFullYear()))
    ).sort((a, b) => b - a) as number[];
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
    // Default ranges
    const editableRanges = [
      { from: 1, to: 10 },
      { from: 11, to: 20 },
      { from: 21, to: 30 },
      { from: 31, to: 40 },
    ];
    heatmapData.value = {
      chartSeries: [], // Let HeatMap build this from rawData
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

async function loadMoreTasks() {
  const itemId: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  await fetchActiveTasks(itemId, true);
}

async function loadMoreRoutines() {
  const itemId: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  await fetchRoutinesUsingTask(itemId, true);
}
watch(
  () => route.params.id,
  (newId) => {
    const itemId: string = Array.isArray(newId) ? newId[0] : newId;
    selectedItem.value = Array.isArray(Items.value)
      ? Items.value.find((item: Item) => item.uuid === itemId)
      : null;
    tasksCurrentPage.value = 1;
    routinesCurrentPage.value = 1;
    fetchActiveTasks(itemId, false);
    fetchRoutinesUsingTask(itemId, false);
    fetchHeatmapData(Array.isArray(newId) ? newId[0] : newId);
  }
);
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
