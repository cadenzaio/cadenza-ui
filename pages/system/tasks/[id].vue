<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }} {{ selectedItem?.version ? ` (v${selectedItem.version})` : '' }}
      </template>
      <div class="row q-mx-md">
        <FlowMap
          v-if="taskMap && taskMap.length > 0"
          :items="taskMap"
          id-field="name"
          label-field="name"
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
              <div class="q-separator" style="height: 2px"></div>
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
              <div
              v-if="selectedItem?.routineName"
                class="q-mx-md q-my-sm"
                @click="navigateToRoutine"
                @contextmenu.prevent="openRoutineInNewTab"
              >
              Routine:
                <span class="text-primary cursor-pointer">{{ selectedItem?.routineName }}</span>
              </div>
              <div class="q-mx-md q-my-sm">
                Created: {{ selectedItem?.created ? new Date(selectedItem.created).toLocaleString() : 'N/A' }}
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
          :taskName="String(route.params.id)"
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

interface Item {
  taskId?: string;
  type?: string;
  name: string;
  version?: string | number;
  description?: string;
  function_string?: string;
  uuid?: string;
  executionId?: any;
  progress?: any;
  serviceDbName?: string;
  service?: string;
  routineName?: string;
  created?: string;
  deleted?: boolean;
  is_unique?: boolean;
  concurrency?: number;
  serviceName?: string;
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

const { data: Items, error } = await useFetch(
  `/api/services/tasks/${route.params.id}`
);

if (error.value) {
  console.error('Error fetching Items:', error.value);
}

const { data: executionData, error: executionError } = await useFetch(
  `/api/activity/tasks/taskExecutionTimes?taskName=${route.params.id}`
);
if (executionError.value) {
  console.error('Error fetching execution times:', executionError.value);
} else if (
  executionData.value &&
  !('error' in executionData.value) &&
  executionData.value.series
) {
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
  executionName: any;
  progress: any;
  name: string;
  uuid: string;
}

interface Routine {
  type: string;
  label: string;
  description: string;
  executionName: any;
  progress: any;
  name: string;
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
const taskMap = ref<any[]>([]);

async function updateTaskMap() {
  if (!selectedItem.value) {
    console.error('updateTaskMap: No selectedItem available');
    taskMap.value = [];
    return;
  }

  try {
    const params = new URLSearchParams();
    params.set('task_name', String(selectedItem.value.name));
    if ((selectedItem.value as any).version) params.set('version', String((selectedItem.value as any).version));
    if ((selectedItem.value as any).service) params.set('service', String((selectedItem.value as any).service));

    const response = await $fetch(`/api/services/tasks/task?${params.toString()}`);
    const itemsArray = Array.isArray(response)
      ? response
      : (response && Array.isArray((response as any).chain) ? (response as any).chain : []);

    const serviceFromSelected = selectedItem.value?.service ?? selectedItem.value?.serviceDbName ?? null;
    const versionFromSelected = (selectedItem.value as any)?.version ?? null;
    taskMap.value = itemsArray.map((item: any) => ({
      ...item,
      service: item.service ?? item.service_name ?? item.serviceName ?? serviceFromSelected,
      version: item.version ?? item.task_version ?? (item as any).taskVersion ?? versionFromSelected,
      isSelected:
        selectedItem.value &&
        (item.uuid === selectedItem.value.name || item.name === selectedItem.value.name),
    }));
    console.log('updateTaskMap: taskMap updated to', taskMap.value);
  } catch (error) {
    console.error('updateTaskMap: Error fetching task map:', error);
    taskMap.value = [];
  }
}

watch([selectedItem, routines], updateTaskMap, { immediate: true });

function onTaskSelected(task: any) {
  console.log('Task selected:', task);
  if (!task) return;

  const canonicalId = task.uuid || task.id || task.name || '';
  if (task.signal === true || String(canonicalId).startsWith('signal::')) {
    const signalName = task.name || String(canonicalId).replace(/^signal::/, '');
    if (signalName) {
      const svc = task.service || task.serviceName || task.serviceDbName || '';
      const qs = svc ? `?serviceName=${encodeURIComponent(String(svc))}` : '';
      navigateToItem(`/system/signals/${encodeURIComponent(String(signalName))}${qs}`);
      return;
    }
  }

  if (task && task.name) {
    const path = `/system/tasks/${encodeURIComponent(String(task.name))}`;
    const qs: string[] = [];
    if ((task as any).version) qs.push(`version=${encodeURIComponent(String((task as any).version))}`);
    if ((task as any).service) qs.push(`service=${encodeURIComponent(String((task as any).service))}`);
    navigateToItem(qs.length > 0 ? `${path}?${qs.join('&')}` : path);
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
  openLinkInNewTab(`/activity/tasks/${task.name}`);
}

function inspectRoutine(routine: Routine) {
  navigateToItem(`/system/routines/${routine.name}`);
}

function inspectRoutineInNewTab(routine: Routine) {
  openLinkInNewTab(`/system/routines/${routine.name}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};
function buildRoutineRoute(item: Item | null): string {
  if (!item || !item.routineName) return `/system/routines/${encodeURIComponent(String(item?.routineName ?? ''))}`;
  const base = `/system/routines/${encodeURIComponent(String(item.routineName))}`;
  const params: string[] = [];
  const svc = item.service ?? item.serviceDbName ?? (item as any).serviceName ?? null;
  if (svc) params.push(`service=${encodeURIComponent(String(svc))}`);
  const ver = (item as any).version ?? (item as any).task_version ?? null;
  if (ver !== null && ver !== undefined && ver !== '') params.push(`version=${encodeURIComponent(String(ver))}`);
  return params.length ? `${base}?${params.join('&')}` : base;
}

const navigateToRoutine = () => {
  const route = buildRoutineRoute(selectedItem.value);
  if (route) navigateToItem(route);
};

const openRoutineInNewTab = () => {
  const route = buildRoutineRoute(selectedItem.value);
  if (route) openLinkInNewTab(route);
};
function normalizeItem(item: any): Item | null {
  if (!item) return null;
  const serviceDbName = item.serviceDbName ?? item.service_name ?? item.service ?? item.serviceName ?? null;
  const normalized: any = {
    taskId: item.taskId ?? item.task_id,
    type: item.type,
    name: item.name,
    version: item.version ?? item.task_version ?? (item as any).taskVersion ?? null,
    description: item.description ?? item.desc ?? null,
    function_string: item.function_string ?? item.functionString ?? item.function ?? null,
    uuid: item.uuid ?? item.name,
    executionId: item.executionId ?? item.execution_id,
    progress: item.progress ?? null,
    serviceDbName,
    service: item.service ?? item.service_name ?? serviceDbName,
    created: item.created ?? item.created_at ?? null,
    deleted: item.deleted ?? false,
    is_unique: item.is_unique ?? item.isUnique ?? null,
    concurrency: item.concurrency ?? null,
    routineName: item.routine_name ?? item.routineName ?? (item.routines && (item.routines.routine_name ?? item.routines.routineName)) ?? null,
  };
  return normalized as Item;
}



onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('system');

  tasksCurrentPage.value = 1;
  routinesCurrentPage.value = 1;

  const itemName: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  if (Array.isArray(Items.value)) {
    const found = Items.value.find((item: Item) => item.name === itemName);
    selectedItem.value = normalizeItem(found);
    const qVersion = route.query.version ?? route.query.v ?? null;
    const qService = route.query.service ?? route.query.s ?? null;
    if (selectedItem.value) {
      if (qVersion) (selectedItem.value as any).version = String(qVersion);
      if (qService) selectedItem.value.service = String(qService);
    }
  } else {
    selectedItem.value = null;
  }
  fetchActiveTasks(itemName, false);
  fetchRoutinesUsingTask(itemName, false);
  fetchHeatmapData(itemName);
});

const taskName = route.params.id;

async function fetchActiveTasks(taskName: string, isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreTasksData.value = true;
      tasksCurrentPage.value++;
    }

    console.log(
      `Fetching active tasks for itemName: ${taskName}, page: ${tasksCurrentPage.value}`
    );
    const response = await fetch(
      `/api/activity/tasks/activeTasks${
        taskName
          ? `?name=${taskName}&page=${tasksCurrentPage.value}&limit=${pageSize}`
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

    console.log('active task Response data:', data);

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

    console.log('active task taskArray:', taskArray);
    if (taskArray.length > 0) {
      console.log('First active task object:', taskArray[0]);
    }

    if (isLoadMore) {
      tasks.value = [...tasks.value, ...taskArray];
    } else {
      tasks.value = taskArray;
    }

    hasMoreTasksData.value = taskArray.length === pageSize;
    console.log('activetasks.value:', tasks.value);
  } catch (error) {
    console.error('Error loading tasks:', error);
    hasMoreTasksData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreTasksData.value = false;
    }
  }
}

async function fetchRoutinesUsingTask(taskName: string, isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreRoutinesData.value = true;
      routinesCurrentPage.value++;
    }

    const response = await fetch(
      `/api/services/routines/routinesWithTask?taskName=${taskName}&page=${routinesCurrentPage.value}&limit=${pageSize}`
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

async function fetchHeatmapData(taskName: string) {
  try {
    const response = await fetch(
      `/api/services/tasks/heatmapData?taskName=${taskName}`
    );
    const rawData = await response.json();
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

async function loadMoreTasks() {
  const itemName: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  await fetchActiveTasks(itemName, true);
}

async function loadMoreRoutines() {
  const itemName: string = Array.isArray(route.params.id)
    ? route.params.id[0]
    : route.params.id;
  await fetchRoutinesUsingTask(itemName, true);
}
watch(
  () => route.params.id,
  (newName) => {
    const itemName: string = Array.isArray(newName) ? newName[0] : newName;
    selectedItem.value = Array.isArray(Items.value)
      ? normalizeItem(Items.value.find((item: Item) => item.name === itemName))
      : null;
    const qVersion = route.query.version ?? route.query.v ?? null;
    const qService = route.query.service ?? route.query.s ?? null;
    if (selectedItem.value) {
      if (qVersion) (selectedItem.value as any).version = String(qVersion);
      if (qService) selectedItem.value.service = String(qService);
    }
    tasksCurrentPage.value = 1;
    routinesCurrentPage.value = 1;
    fetchActiveTasks(itemName, false);
    fetchRoutinesUsingTask(itemName, false);
    fetchHeatmapData(Array.isArray(newName) ? newName[0] : newName);
  }
);
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
