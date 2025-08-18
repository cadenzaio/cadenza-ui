<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }}
      </template>

      <div class="row q-mx-md">
        <FlowMap
          :items="tasksWithId"
          id-field="uuid"
          label-field="name"
          previous-field="previous_task_execution_id"
          @item-selected="onTaskSelected"
        />
        <div v-if="error" class="text-negative q-pa-md">
          {{ error }}
        </div>
        <div v-else-if="isLoading" class="text-center q-pa-md">Loading...</div>
        <InfoCard v-else-if="selectedItem">
          <template #title>
            {{ selectedItem?.name }}
          </template>
          <template #info>
            <div class="flex-column full-width">
              <div class="q-mx-md q-my-sm">
                Description: {{ selectedItem?.description }}
              </div>
              <div class="q-mx-md q-my-sm">
                Modified: {{ selectedItem?.modified }}
              </div>
              <div class="q-mx-md q-my-sm">
                Deleted: {{ selectedItem?.deletedStatus }}
              </div>
              <div class="q-mx-md q-my-sm">
                Created: {{ selectedItem?.created }}
              </div>
            </div>
          </template>
        </InfoCard>
      </div>

      <div class="row q-mx-md">
        <Table
          class="custom-table"
          :columns="columns"
          :rows="activeProcesses"
          row-key="uuid"
          @inspect-row="inspectServer"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreServers"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        >
          <template #title> Instances of This Service </template>
        </Table>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from '#app';
import InfoCard from '~/components/InfoCard.vue';
import { useAppStore } from '~/stores/app';

const router = useRouter();
const route = useRoute();
const activeProcesses = ref<Server[]>([]);
const tasksInService = ref<Task[]>([]);
const tasksWithId = computed(() =>
  tasksInService.value.map((task) => ({
    ...task,
    id: task.uuid,
  }))
);
const processingGraph = route.params.id as string;
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;

const columns = [
  {
    name: 'graph',
    label: 'Service',
    field: 'graph',
    required: true,
    sortable: true,
  },
  {
    name: 'address',
    label: 'Address',
    field: 'address',
    required: true,
    sortable: true,
  },
  {
    name: 'port',
    label: 'Port',
    field: 'port',
    required: true,
    sortable: true,
  },
  {
    name: 'processPid',
    label: 'Process PID',
    field: 'processPid',
    required: true,
    sortable: true,
  },
];

function inspectServer(server: Server) {
  navigateToItem(`/activity/servers/${server.uuid}`);
}

function inspectInNewTab(server: Server) {
  const url = `/activity/servers/${server.uuid}`;
  window.open(url, '_blank');
}

function onServerSelected(server: any) {
  // Navigate to the server details page when a server node is selected in the FlowMap
  navigateToItem(`/activity/servers/${server.uuid || server.id}`);
}

function onTaskSelected(task: any) {
  // Navigate to the task details page when a task node is selected in the FlowMap
  navigateToItem(`/services/tasks/${task.uuid || task.id}`);
}

const navigateToItem = (route: string) => {
  useRouter().push(route);
};

const fetchFilteredServers = async (isLoadMore = false): Promise<void> => {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    error.value = null;
    const response = await fetch(
      `/api/activity/servers/activeServers?processingGraph=${encodeURIComponent(
        processingGraph
      )}&page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Failed to fetch filtered servers');
    const data = await response.json();

    if (isLoadMore) {
      activeProcesses.value = [
        ...activeProcesses.value,
        ...(data.servers || []),
      ];
    } else {
      activeProcesses.value = data.servers || [];
    }

    hasMoreData.value = (data.servers || []).length === pageSize;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error fetching servers: ${errorMessage}`;
    console.error('Error fetching servers:', err);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
};

const loadMoreServers = async (): Promise<void> => {
  await fetchFilteredServers(true);
};

const fetchTasksInService = async (): Promise<void> => {
  try {
    error.value = null;
    const response = await fetch(
      `/api/services/tasksInService?serviceName=${encodeURIComponent(
        processingGraph
      )}`
    );
    if (!response.ok) throw new Error('Failed to fetch tasks in service');
    const data = await response.json();

    tasksInService.value = data || [];
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error fetching tasks: ${errorMessage}`;
    console.error('Error fetching tasks:', err);
  }
};

const fetchGraphDetails = async (): Promise<void> => {
  try {
    error.value = null;
    const response = await fetch(
      `/api/services/graphs/${encodeURIComponent(processingGraph)}`
    );
    if (!response.ok) throw new Error('Failed to fetch graph details');
    const data = await response.json();

    selectedItem.value = data;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error fetching graph details: ${errorMessage}`;
    console.error('Error fetching graph details:', err);
  }
};

interface Item {
  name: string;
  description: string;
  modified: string;
  deleted: boolean;
  created: string;
  deletedStatus: string;
}

interface Server {
  uuid: string;
  graph: string;
  address: string;
  port: number;
  processPid: number;
  status: string;
  isPrimary: boolean;
  modified: string;
  displayStatus: string;
}

interface Task {
  uuid: string;
  name: string;
  description?: string;
  processing_graph: string;
  layer_index: number;
  is_unique: boolean;
  concurrency: number;
  task_id: string;
  previous_task_execution_id?: string;
}

const selectedItem = ref<Item | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('services');

  currentPage.value = 1; // Always start at page 1 on mount

  try {
    isLoading.value = true;
    error.value = null;

    await Promise.all([
      fetchGraphDetails(),
      fetchTasksInService(),
      fetchFilteredServers(),
    ]);
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error loading data: ${errorMessage}`;
    console.error('Error in onMounted:', err);
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
