<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Services </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="graphs"
          row-key="name"
          @inspect-row="inspectGraphs"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreGraphs"
          :hideGenerateTraceButton="true"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useFetch } from '#app';
import { useRouter } from '#vue-router';
import { useAppStore } from '@/stores/app';

interface Graph {
  type: string;
  label: string;
  description: string;
  name: string;
  uuid?: string;
  displayName?: string;
}

interface TableColumn {
  name: string;
  label: string;
  field: string;
  required: boolean;
  sortable: boolean;
}

import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';

const layout = 'dashboard-layout';
const selectedGraph = ref<Graph[] | undefined>(undefined);

const columns: TableColumn[] = [
  {
    name: 'label',
    label: 'Name',
    field: 'label',
    required: true,
    sortable: true,
  },
];

const graphs = ref<Graph[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);

const currentPage = ref(1);
const pageSize = 50;

async function loadGraphs(isLoadMore = false): Promise<void> {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const response = await fetch(
      `/api/services/graphs/graphs?page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    const mappedData: Graph[] = data.map((r: any) => ({
      uuid: r.uuid || r.id,
      label: r.displayName || r.label || r.name || r.service_name || r.uuid,
      type: r.type || 'service',
      name: r.name || r.label || r.service_name || r.uuid,
      description: r.description || '',
      displayName: r.displayName,
    }));

    if (isLoadMore) {
      graphs.value = [...graphs.value, ...mappedData];
    } else {
      graphs.value = mappedData;
    }

    hasMoreData.value = data.length === pageSize;
  } catch (error) {
    console.error('Error loading graphs:', error);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
}

async function loadMoreGraphs() {
  await loadGraphs(true);
}

const router = useRouter();
function inspectGraphs(graph: Graph): void {
  navigateToItem(`/system/services/${graph.name}`);
}

const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(graph: Graph): void {
  openLinkInNewTab(`/system/services/${graph.name}`);
}
const navigateToItem = (route: string) => {
  router.push(route);
};

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('system');
  currentPage.value = 1;
  await loadGraphs(false);
});
</script>
