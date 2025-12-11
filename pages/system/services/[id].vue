<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }}
      </template>

      <div class="row q-mx-md">
        <div class="col-8">
          <FlowMap v-if="flowItems.length > 0" :items="flowItems" :full-width="true" @item-selected="onFlowItemSelected" />
          <div v-else-if="isLoading" class="text-center q-pa-md">Loading...</div>
        </div>
        <div class="col-4">
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
        </div>
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
import FlowMap from '~/components/FlowMap.vue';
import { useAppStore } from '~/stores/app';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const currentSection = computed(() => appStore.currentSection);
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

const flowItems = computed(() => {
  try {
    const nodeById = new Map(nodes.value.map((n: any) => [n.id ?? n.uuid ?? n.name, n]));
    return (nodes.value || [])
      .filter((n: any) => n.nodeType === 'task' || n.nodeType === 'signal')
      .map((n: any) => {
        const incoming = (edges.value || [])
          .filter((e: any) => e.target === (n.id ?? n.uuid ?? n.name))
          .map((e: any) => e.source);

        return {
          id: n.id ?? n.uuid ?? n.name,
          name: n.name ?? n.label ?? n.id ?? n.uuid,
          label: n.data?.label ?? n.label ?? n.name ?? n.id,
          description: n.data?.description ?? n.description ?? '',
          signal: n.nodeType === 'signal' || n.data?.signal === true,
          nodeType: n.nodeType,
          parentNode: n.parentNode,
          version: n.data?.version ?? n.version ?? (n?.metadata?.version ?? undefined),
          service: n.data?.service_name ?? n.service ?? n.parentNode ?? undefined,
          previousId: incoming.length > 0 ? incoming : undefined,
          original: n,
        };
      });
  } catch (err) {
    console.error('Error building flowItems:', err);
    return [];
  }
});

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

interface Item {
  name: string;
  description: string;
  modified: string;
  deleted: boolean;
  created: string;
  deletedStatus: string;
  displayName: string;
  function_string?: string; 
  type?: string; 
  service_instance?: string; 
}

function onFlowItemSelected(item: any) {
  try {
    const base = (currentSection.value as string) || 'system';

    const payload = item?.original ?? item;

    if (item.nodeType === 'task' || payload?.nodeType === 'task') {
      const taskName = item.name || item.label || payload?.data?.taskName || payload?.id;
      if (!taskName) return;

      const version = item.version ?? payload?.data?.version ?? payload?.version ?? '1';
      const serviceName =
        // prefer the explicit service name attached to the node data
        payload?.data?.service_name ?? item.service ?? payload?.service ?? payload?.parentNode ?? service;

      router.push({
        path: `/${base}/tasks/${encodeURIComponent(String(taskName))}`,
        query: { version: String(version), service: String(serviceName) },
      });
      return;
    }

    if (item.nodeType === 'signal' || item.signal || payload?.nodeType === 'signal') {
      let rawSignal = item.label ?? item.name ?? payload?.id ?? '';
      let signalRawStr = String(rawSignal).replace(/^signal::/, '').trim();
      const toIdx = signalRawStr.lastIndexOf('-to-');
      let signalName = toIdx !== -1 ? signalRawStr.substring(toIdx + 4) : signalRawStr;
      if (signalName.includes('->')) {
        const parts = signalName.split('->');
        signalName = parts[parts.length - 1];
      }
      signalName = signalName.trim();
      if (!signalName) return;

      const serviceName = item.parentNode || payload?.parentNode || payload?.data?.service_name || service;

      router.push({ path: `/${base}/signals/${encodeURIComponent(String(signalName))}`, query: { serviceName } });
      return;
    }
  } catch (err) {
    console.error('Error handling FlowMap item-selected:', err);
  }
}
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
