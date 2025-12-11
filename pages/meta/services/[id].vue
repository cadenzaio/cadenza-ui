<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ selectedItem?.name }}
      </template>

      <div class="row q-mx-md">
        <FlowMap
          v-if="flowItems.length > 0"
          :items="flowItems"
          @item-selected="handleFlowItemSelected"
        />
        <!-- <div class="q-pa-sm text-center">
          <div v-if="hasMoreData" ref="loadMoreSentinel">
            <span v-if="loadingMoreData">Loading page {{ currentPage }}...</span>
          </div>
        </div>
        <div v-if="isLoading && flowItems.length === 0" class="text-center q-pa-md">Loading page {{ currentPage }}...</div> -->
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
              @contextmenu.prevent="openLinkInNewTab(`/activity/services/${row.uuid}`)"
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
import { ref, onMounted, computed, watch, onUnmounted, nextTick } from 'vue';
import { useRouter, useRoute } from '#app';
import InfoCard from '~/components/InfoCard.vue';
import FlowMap from '~/components/FlowMap.vue';
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
const pageSize = 100;
const isLoading = ref(false);
const error = ref<string | null>(null);
const selectedItem = ref<Item | null>(null);
const loadMoreSentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

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

const flowItems = computed<any[]>(() => {
  if (!nodes.value || nodes.value.length === 0) return [];

  return nodes.value
    .filter((n: any) => n.nodeType !== 'service' && n.nodeType !== 'routine')
    .map((n: any) => {
      const incoming = edges.value
        .filter((e: any) => e.target === n.id)
        .map((e: any) => e.source);
      const previous = incoming.length === 0 ? undefined : incoming.length === 1 ? incoming[0] : incoming;
      return {
        name: n.data?.name || n.id,
        label: n.data?.label || n.id,
        description: n.data?.description || '',
        signal: n.nodeType === 'signal' || n.data?.signal === true,
        signalUuid: n.data?.uuid || null,
        previousId: previous,
      };
    });
});

function extractUuid(s: string | null | undefined) {
  if (!s) return null;
  const m = String(s).match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0] : null;
}

function handleFlowItemSelected(item: any) {
  if (!item) return;
  const canonicalId = item.signalUuid || item.name || item.id || '';

  if (item.signal === true || String(canonicalId).startsWith('signal::')) {
    const raw = String(item.name || canonicalId);
    const stripped = raw.replace(/^signal::/, '');
    const serviceName = (selectedItem as any)?.value?.name || item.service || item.service_name || null;
    const query = serviceName ? `?serviceName=${encodeURIComponent(String(serviceName))}` : '';
    router.push(`/meta/signals/${encodeURIComponent(stripped)}${query}`);
    return;
  }

  if (item && item.name) {
    const path = `/meta/tasks/${encodeURIComponent(String(item.name))}`;
    const qs: string[] = [];
    const version = item.version ?? item.task_version ?? null;
    const serviceParam = (selectedItem as any)?.value?.name ?? item.service ?? item.service_name ?? null;
    if (version) qs.push(`version=${encodeURIComponent(String(version))}`);
    if (serviceParam) qs.push(`service=${encodeURIComponent(String(serviceParam))}`);
    router.push(qs.length > 0 ? `${path}?${qs.join('&')}` : path);
  }
}

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

async function fetchTasksInService(page = 1) {
  try {
    error.value = null;
    loadingMoreData.value = true;
    const response = await fetch(
      `/api/meta/metaService?serviceName=${encodeURIComponent(service)}&page=${page}&pageSize=${pageSize}`
    );
    if (!response.ok) throw new Error('Failed to fetch tasks in service');
    const data = await response.json();

    const incomingNodes: any[] = data.nodes || [];
    const incomingEdges: any[] = data.edges || [];
    const existingTaskIds = new Set(nodes.value.filter((n: any) => n.nodeType === 'task').map((n: any) => n.id));
    const incomingTaskNodes = incomingNodes.filter((n: any) => n.nodeType === 'task');
    const newTaskNodes = incomingTaskNodes.filter((n: any) => !existingTaskIds.has(n.id));
    const newTaskCount = newTaskNodes.length;

    if (page === 1) {
      nodes.value = incomingNodes;
      edges.value = incomingEdges;
    } else {
      const existingNodeIds = new Set(nodes.value.map((n: any) => n.id));
      incomingNodes.forEach((n) => {
        if (!existingNodeIds.has(n.id)) {
          nodes.value.push(n);
          existingNodeIds.add(n.id);
        }
      });

      const existingEdgeIds = new Set(edges.value.map((e: any) => e.id));
      incomingEdges.forEach((e) => {
        if (!existingEdgeIds.has(e.id)) {
          edges.value.push(e);
          existingEdgeIds.add(e.id);
        }
      });
    }

    const totalCount = typeof data.totalCount === 'number' ? data.totalCount : null;
    const loadedTasks = nodes.value.filter((n: any) => n.nodeType === 'task').length;
    if (!incomingNodes || incomingNodes.length === 0) {
      hasMoreData.value = false;
    } else if (totalCount !== null) {
      hasMoreData.value = loadedTasks < totalCount;
    } else if (newTaskCount === 0) {
      hasMoreData.value = false;
    } else {
      hasMoreData.value = (incomingNodes.length ?? 0) >= pageSize;
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown error occurred';
    error.value = `Error fetching tasks: ${errorMessage}`;
    console.error('Error fetching tasks:', err);
  } finally {
    loadingMoreData.value = false;
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
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');

  try {
    isLoading.value = true;
    currentPage.value = 1;
    nodes.value = [];
    edges.value = [];

    await Promise.all([
      fetchTasksInService(currentPage.value),
      fetchServerDetails(),
      fetchActiveExecutions(),
    ]);
    if (hasMoreData.value) {
      await loadAllPages();
    }
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
      currentPage.value = 1;
      nodes.value = [];
      edges.value = [];
      await Promise.all([
        fetchTasksInService(currentPage.value),
        fetchServerDetails(),
        fetchActiveExecutions(),
      ]);
        if (hasMoreData.value) {
          await loadAllPages();
        }
    }
  }
);

function loadMoreNodes() {
  if (!hasMoreData.value || loadingMoreData.value) return;
  loadingMoreData.value = true;
  currentPage.value += 1;
  fetchTasksInService(currentPage.value).catch((err) => {
    console.error('Error loading more nodes:', err);
  });
}

async function loadAllPages() {
  try {
    while (hasMoreData.value) {
      if (loadingMoreData.value) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      loadingMoreData.value = true;
      currentPage.value += 1;
      try {
        await fetchTasksInService(currentPage.value);
      } catch (err) {
        console.error('Error loading page', currentPage.value, err);
        break;
      }
    }
  } finally {
    loadingMoreData.value = false;
  }
}

function setupAutoPager() {
  if (observer) return;
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && hasMoreData.value && !loadingMoreData.value) {
        loadMoreNodes();
      }
    }
  }, {
    root: null,
    rootMargin: '200px',
    threshold: 0.1,
  });

  watch(hasMoreData, async (val) => {
    await nextTick();
    if (val && loadMoreSentinel.value) observer!.observe(loadMoreSentinel.value);
    if (!val && loadMoreSentinel.value) observer!.unobserve(loadMoreSentinel.value);
  }, { immediate: true });

  onMounted(async () => {
    await nextTick();
    if (hasMoreData.value && loadMoreSentinel.value) observer!.observe(loadMoreSentinel.value);
  });

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });
}

setupAutoPager();

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
</script>

<style scoped>
.custom-table {
  background-color: #e6b30dc4;
}
</style>
