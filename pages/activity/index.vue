<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Service Activity </template>
      <div class="row q-mx-md">
        <ServerMap @node-selected="onServerSelected" class="q-mx-md" />
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
      <q-dialog v-model="dialogVisible">
        <q-card class="my-card">
          <q-card-section>
            <div class="row no-wrap items-center">
              <div class="col text-h6 ellipsis">Service Status</div>
            </div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <ServerStats
              v-if="selectedServer"
              :selectedServer="selectedServer"
            />
            <InfoCard>
              <template #title> Server Info </template>
              <template #info>
                <ul>
                  <li>
                    Service: {{ selectedServer?.graph || 'Unknown service' }}
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
import { ref, onMounted, watch } from 'vue';
import { useAppStore } from '~/stores/app';
import { useRouter } from '#vue-router';
import ServerMap from '~/components/serverMap.vue';

const router = useRouter();
const dialogVisible = ref(false);
const selectedServer = ref<Server | undefined>(undefined);
const servers = ref<Server[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const loading = ref(false);
const error = ref<string | null>(null);

interface TableColumn {
  name: string;
  label: string;
  field: string;
  required: boolean;
  sortable: boolean;
}

const columns: TableColumn[] = [
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
];

interface Server {
  uuid: string;
  address: string;
  port: string;
  graph: string;
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
      servers.value = [...servers.value, ...(data.servers || [])];
    } else {
      servers.value = data.servers || [];
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

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
  currentPage.value = 1; // Always start at page 1 on mount
  await fetchServerStats();
});
</script>
<style scoped>
.my-card {
  min-width: 50dvw;
  max-width: 500px;
  border-radius: 15px;
}
</style>
