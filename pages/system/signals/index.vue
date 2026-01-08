<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Signals </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="signals"
          row-key="uuid"
          @inspect-row="inspectSignal"
          @inspect-row-in-new-tab="inspectInNewTab"
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
import { useRouter } from '#vue-router';
import { useAppStore } from '~/stores/app';

interface Signal {
  name: string;
  status: string;
  value: string;
  started: string;
  ended: string;
  duration: number;
  uuid: string;
  service: string;
}

const columns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
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
  {
    name: 'service',
    label: 'Service',
    field: 'service',
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
  {
    name: 'ended',
    label: 'Ended',
    field: 'ended',
    required: true,
    sortable: true,
  },
  {
    name: 'duration',
    label: 'Duration (sec)',
    field: 'duration',
    required: true,
    sortable: true,
  },
];

const signals = ref<Signal[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50000;

async function loadSignals(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const response = await $fetch(`/api/services/signals/signals?page=${currentPage.value}&limit=${pageSize}`);
    const rows = response || [];

    const data = rows.map((r: any) => ({
      name: r.name,
      status: r.is_meta ? 'meta' : 'signal',
      service: r.service_name || '',
      started: r.created || '',
      ended: '',
      duration: 0,
      uuid: r.name,
      value: r.value || '',
    }));

    if (isLoadMore) {
      signals.value = [...signals.value, ...data];
    } else {
      signals.value = data;
    }

    hasMoreData.value = data.length === pageSize;
  } catch (error) {
    console.error('Error loading signals:', error);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
}

async function loadMoreSignals() {
  await loadSignals(true);
}

const router = useRouter();

function inspectSignal(signal: Signal) {
  navigateToItem(`/system/signals/${signal.name}`);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(signal: Signal) {
  openLinkInNewTab(`/system/signals/${signal.name}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('system');
  currentPage.value = 1;
  await loadSignals(false);
});
</script>
