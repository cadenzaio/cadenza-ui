<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }}
      </template>

      <div class="row q-mx-md">
        <NestedFlowMap
          v-if="nodes.length > 0"
          :nodes="nodes"
          :edges="edges"
          />
        <div v-else-if="isLoading" class="text-center q-pa-md">Loading...</div>
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
              <div class="q-mx-md q-my-sm">Type: {{ selectedItem?.type }}</div>
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
         <!-- <ExecutionStatisticsPieChart 
          type="routine"
          :routineName="String(route.params.id)"
        />
        <ExecutionTimeChart v-if="selectedItem" :series="executionTimeSeries" />
        <div v-if="error" class="text-negative q-pa-md">
          {{ error }}
        </div> -->
      </div>
      <div class="row q-mx-md">
        <Table
          class="custom-table"
          :columns="columns"
          :rows="activeProcesses"
          row-key="uuid"
          @inspect-row="inspectService"
          @inspect-row-in-new-tab="inspectInNewTab"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        >
          <template #body="props">
            <tr
              v-for="row in props.rows"
              :key="row.uuid"
              @click="inspectService(row)"
              @contextmenu.prevent="
                openLinkInNewTab(`/activity/services/${row.uuid}`)
              "
            >
              <td v-for="col in props.cols" :key="col.name">
                {{ row[col.field] }}
              </td>
            </tr>
          </template>
          <template #title> Instances of This Service </template>
        </Table>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from '#app';
import InfoCard from '~/components/InfoCard.vue';
import NestedFlowMap from '~/components/NestedFlowMap.vue';
import { useAppStore } from '~/stores/app';

const router = useRouter();
const route = useRoute();
const activeProcesses = ref<Service[]>([]);
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const service = route.params.id as string;
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const isLoading = ref(false);
const error = ref<string | null>(null);
const selectedItem = ref<Item | null>(null);

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

function inspectService(service: Service) {
  navigateToItem(`/activity/services/${service.uuid}`);
}

import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(service: Service) {
  openLinkInNewTab(`/activity/services/${service.uuid}`);
}

function navigateToItem(route: string) {
  router.push(route);
}

async function fetchTasksInService() {
  try {
    error.value = null;
    const response = await fetch(
      `/api/services/tasksInService?serviceName=${encodeURIComponent(service)}`
    );
    if (!response.ok) throw new Error('Failed to fetch tasks in service');
    const data = await response.json();
    nodes.value = data.nodes;
    edges.value = data.edges;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error fetching tasks: ${errorMessage}`;
    console.error('Error fetching tasks:', err);
  }
}

// Updated the `fetchServerDetails` function to include all required properties
async function fetchServerDetails() {
  try {
    error.value = null;
    const response = await fetch(`/api/activity/servers/${service}`);
    if (!response.ok) throw new Error('Failed to fetch server details');
    const data = await response.json();

    if (data.length > 0) {
      const server = data[0];
      selectedItem.value = {
        name: server.service_name,
        description: `Address: ${server.address}, Port: ${server.port}`,
        function_string: `PID: ${server.process_pid}, Primary: ${server.is_primary}`,
        type: server.is_active ? 'Active' : 'Inactive',
        service_instance: server.service_instance_uuid,
        created: server.created,
        deleted: server.deleted,
        modified: server.service_instance_modified,
        deletedStatus: server.deleted ? 'Deleted' : 'Active',
        displayName: server.service_name,
      };
    } else {
      selectedItem.value = null;
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error fetching server details: ${errorMessage}`;
    console.error('Error fetching server details:', err);
  }
}

// Add a function to fetch active executions
async function fetchActiveExecutions() {
  try {
    error.value = null;
    const response = await fetch(`/api/activity/servers/activeServers?serviceInstance=${encodeURIComponent(service)}`);
    if (!response.ok) throw new Error('Failed to fetch active executions');
    const data = await response.json();
    activeProcesses.value = data.servers.map((server: { uuid: any; service: any; address: any; port: any; processPid: any; displayStatus: any; }) => ({
      uuid: server.uuid,
      graph: server.service,
      address: server.address,
      port: server.port,
      processPid: server.processPid,
      status: server.displayStatus,
    }));
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error fetching active executions: ${errorMessage}`;
    console.error('Error fetching active executions:', err);
  }
}

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('system');

  try {
    isLoading.value = true;
    await Promise.all([
      fetchTasksInService(),
      fetchServerDetails(),
      fetchActiveExecutions(),
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

watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId !== oldId) {
      await Promise.all([
        fetchTasksInService(),
        fetchServerDetails(),
        fetchActiveExecutions(),
      ]);
    }
  }
);

// Define missing types
interface Service {
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

// Updated the `Item` interface to include `type` and `service_instance`
interface Item {
  name: string;
  description: string;
  modified: string;
  deleted: boolean;
  created: string;
  deletedStatus: string;
  displayName: string;
  function_string?: string; // Added optional property
  type?: string; // Added optional property
  service_instance?: string; // Added optional property
}
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
