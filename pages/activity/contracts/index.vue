<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Contracts </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="contracts"
          row-key="uuid"
          @inspect-row="inspectContracts"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreContracts"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        />
        <FrequencyPieChart v-if="contracts.length > 0" :values="contracts" />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useFetch } from '#app';
import { useRouter } from '#vue-router';

interface contracts {
  type: string;
  label: string;
  description: string;
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

const layout = 'dashboard-layout';
const selectedContract = ref<contracts[] | undefined>(undefined);
watch(selectedContract, (newValue) => {});

const columns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    required: true,
    sortable: true,
  },
  {
    name: 'agent_name',
    label: 'Agent',
    field: 'agent_name',
    required: true,
    sortable: false,
  },
  {
    name: 'issued',
    label: 'Issued',
    field: 'issued',
    required: true,
    sortable: true,
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    required: true,
    sortable: true,
  },
];

const contracts = ref<contracts[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;

const router = useRouter();

function inspectContracts(contracts: contracts) {
  navigateToItem(`contracts/${contracts.uuid}`);
}
function inspectInNewTab(contracts: contracts) {
  const url = `/contracts/${contracts.uuid}`;
  window.open(url, '_blank');
}

const navigateToItem = (route: string) => {
  router.push(route);
};

async function loadContracts(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const response = await fetch(
      `/api/contracts/contracts?page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    if (isLoadMore) {
      contracts.value = [...contracts.value, ...data.contracts];
    } else {
      contracts.value = data.contracts;
    }

    hasMoreData.value = data.contracts.length === pageSize;
  } catch (error) {
    console.error('Error loading contracts:', error);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
}

async function loadMoreContracts() {
  await loadContracts(true);
}

// Fetch server stats and set the current section on component mount
onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
  await loadContracts();
});
</script>
