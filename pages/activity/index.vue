<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Service Activity </template>
      <div class="row q-mx-md">
        <ServerMap
          :nodes="mapNodes"
          :edges="mapEdges"
          :loading="mapLoading"
          @node-selected="onServerSelected"
          class="q-mx-md"
          :nodeTypes="{ customNode: CustomNode }"
        />
        <Table
          :columns="columns"
          :rows="servers"
          row-key="uuid"
          @inspect-row="inspectServer"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreServers"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        />
      </div>
      <q-dialog v-model="dialogVisible" >
        <q-card class="my-card" style="min-width: 45dvw; max-width: 65dvw">
          <q-card-section>
            <div class="row no-wrap items-center">
              <div class="col text-h6 ellipsis">Service Status</div>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <ServiceTimeChart :series="timeChartSeries" />
            <InfoCard>
              <template #title> Server Info </template>
              <template #info>
                <ul>
                  <li>
                    Service: {{ selectedServer?.service || 'Unknown service' }}
                  </li>
                  <li>Server: {{ selectedServer?.uuid || 'N/A' }}</li>
                  <li>IP: {{ selectedServer?.address || 'N/A' }}</li>
                  <li>PORT: {{ selectedServer?.port || 'N/A' }}</li>
                  <li>Status: {{ selectedServer?.status || 'Unknown' }}</li>
                </ul>
              </template>
            </InfoCard>
          </q-card-section>
        </q-card>
      </q-dialog>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import CustomNode from '~/components/CustomNode.vue';
import { useAppStore } from '~/stores/app';
import { useRouter } from '#vue-router';
import ELK from 'elkjs/lib/elk.bundled.js';
import ServerMap from '~/components/serverMap.vue';
import ServiceTimeChart from '~/components/ServiceTimeChart.vue';
import type { Node, Edge, Position } from '@vue-flow/core';

// Table and dialog state
const router = useRouter();
const dialogVisible = ref(false);
const selectedServer = ref<Server | any>(undefined);
const servers = ref<Server[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const loading = ref(false);
const error = ref<string | null>(null);
const timeChartSeries = ref<any[]>([]);

async function fetchTaskSeries(serviceInstanceId: string | null) {
  if (!serviceInstanceId) return [];
  try {
    const qs = `?serviceInstanceId=${encodeURIComponent(serviceInstanceId)}`;
    const res: any = await $fetch(`/api/activity/servers/serverStatistics${qs}`);
    if (res && Array.isArray(res.series)) {
      return res.series;
    }
    return [];
  } catch (e) {
    console.error('Failed to fetch task series:', e);
    return [];
  }
}

interface TableColumn {
  name: string;
  label: string;
  field: string;
  required: boolean;
  sortable: boolean;
}

const columns: TableColumn[] = [
  {
    name: 'service',
    label: 'Service',
    field: 'service',
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
];

interface Server {
  uuid: string;
  address: string;
  port: string;
  service_name: string;
  status: string;
  isPrimary: boolean;
  processPid: number;
  modified: string;
}

function inspectServer(server: Server): void {
  navigateToItem(`/activity/services/${server.uuid}`);
}
function inspectInNewTab(server: Server): void {
  const url = `/activity/services/${server.uuid}`;
  window.open(url, '_blank');
}
const navigateToItem = (route: string) => {
  router.push(route);
};

const onServerSelected = (serverUuid: string) => {
  selectedServer.value = servers.value.find(
    (server: Server) => server.uuid === serverUuid
  );
  dialogVisible.value = true;
  if (selectedServer.value) {
    fetchTaskSeries(serverUuid).then((taskSeries) => {
      timeChartSeries.value = Array.isArray(taskSeries) ? taskSeries : [];
    });
  }
};

const fetchServerStats = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMoreData.value = true;
    currentPage.value++;
  } else {
    loading.value = true;
  }

  error.value = null;
  try {
    const response = await fetch(
      `/api/activity/servers/activeServers?page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (isLoadMore) {
      servers.value = [
        ...servers.value,
        ...(data.servers || []).map((server: any) => ({
          ...server,
          service_name: server.service,
        })),
      ];
    } else {
      servers.value = (data.servers || []).map((server: any) => ({
        ...server,
        service_name: server.service,
      }));
    }

    hasMoreData.value = (data.servers || []).length === pageSize;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An error occurred';
    console.error('Error fetching server stats:', err);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    } else {
      loading.value = false;
    }
  }
};

async function loadMoreServers() {
  await fetchServerStats(true);
}

const mapNodes = ref<Node[]>([]);
const mapEdges = ref<Edge[]>([]);
const mapLoading = ref(false);
const elk = new ELK();

async function layoutGraph(nodes: Node[], edges: Edge[]) {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '0',
      'elk.layered.spacing.nodeNodeBetweenLayers': '200',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '0',
    },
    children: nodes.map((node) => ({
      ...node,
      width: typeof node.width === 'number' ? node.width : 100,
      height: typeof node.height === 'number' ? node.height : 50,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
      type: edge.type || 'default',
      style: edge.style || { stroke: '#1976d2', strokeWidth: 2 },
    })),
  };
  const layouted = await elk.layout(elkGraph);
  return nodes.map((node) => {
    const layoutNode = layouted.children?.find((n) => n.id === node.id);
    return {
      ...node,
      position: {
        x: layoutNode && typeof layoutNode.x === 'number' ? layoutNode.x : 0,
        y: layoutNode && typeof layoutNode.y === 'number' ? layoutNode.y : 0,
      },
    };
  });
}

async function fetchServerMap() {
  mapLoading.value = true;
  try {
    const serverMap = await $fetch('/api/activity/serverMap');
    if (serverMap && serverMap.length > 0) {
      const activeServers = serverMap.filter((server: any) => server.is_active);
      const uniqueServers = new Map();
      activeServers.forEach((server: any) => {
        uniqueServers.set(server.server_id, server);
      });
      const nodes: Node[] = [];
      uniqueServers.forEach((server: any, serverId: string) => {
        nodes.push({
          id: serverId,
          position: { x: 0, y: 0 },
          sourcePosition: 'right' as Position,
          targetPosition: 'left' as Position,
          data: { label: server.service_name },
          type: 'customNode',
        });
      });
      const edges: Edge[] = [];
      activeServers.forEach((server: any) => {
        if (server.client_id && uniqueServers.has(server.client_id)) {
          edges.push({
            id: `e${server.server_id}-${server.client_id}`,
            source: server.client_id,
            target: server.server_id,
            animated: false,
            style: { stroke: '#333' },
          });
        }
      });
      mapNodes.value = await layoutGraph(nodes, edges);
      mapEdges.value = edges;
    } else {
      mapNodes.value = [];
      mapEdges.value = [];
    }
  } catch (error) {
    mapNodes.value = [];
    mapEdges.value = [];
  } finally {
    mapLoading.value = false;
  }
}

onMounted(() => {
  fetchServerMap();
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
  currentPage.value = 1;
  fetchServerStats();
});
</script>
