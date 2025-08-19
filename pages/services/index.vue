<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Services </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="graphs"
          row-key="uuid"
          @inspect-row="inspectGraphs"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreGraphs"
          :hideGenerateContractButton="true"
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
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

interface TableColumn {
  name: string;
  label: string;
  field: string;
  required: boolean;
  sortable: boolean;
}

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
  {
    name: 'description',
    label: 'Description',
    field: 'description',
    required: true,
    sortable: false,
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
      uuid: r.uuid,
      label: r.label,
      description: r.description,
      type: r.type,
      id: r.id,
      executionId: r.executionId,
      progress: r.progress,
    }));

    if (isLoadMore) {
      graphs.value = [...graphs.value, ...mappedData];
    } else {
      graphs.value = mappedData;
    }

    // Check if we have more data
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
  navigateToItem(`/services/${graph.uuid}`);
}

function inspectInNewTab(graph: Graph): void {
  const url = `/services/${graph.uuid}`;
  window.open(url, '_blank');
}
const navigateToItem = (route: string) => {
  router.push(route);
};

// Fetch server stats and set the current section on component mount
onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('services');
  currentPage.value = 1; // Always start at page 1 on mount
  await loadGraphs(false);
});
</script>
