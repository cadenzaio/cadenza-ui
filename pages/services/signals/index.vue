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
    name: 'value',
    label: 'Value',
    field: 'value',
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
const pageSize = 50;

async function loadSignals(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    // Replace with your endpoint when ready
    // const response = await fetch(`/api/services/signals?page=${currentPage.value}&limit=${pageSize}`);
    // if (!response.ok) throw new Error('Network response was not ok');
    // const data = await response.json();

    // For now, use hardcoded mock data
    const data = [
      {
        name: 'Signal 1',
        status: 'check',
        value: 'OK',
        started: '2025-08-21T10:00:00Z',
        ended: '2025-08-21T10:00:01Z',
        duration: 1,
        uuid: 'sig-1',
      },
      {
        name: 'Signal 2',
        status: 'close',
        value: 'Threshold Exceeded',
        started: '2025-08-21T09:55:00Z',
        ended: '2025-08-21T09:55:05Z',
        duration: 5,
        uuid: 'sig-2',
      },
      {
        name: 'Signal 3',
        status: 'play_arrow',
        value: 'In Progress',
        started: '2025-08-21T09:50:00Z',
        ended: '',
        duration: 0,
        uuid: 'sig-3',
      },
      {
        name: 'Signal 4',
        status: 'schedule',
        value: 'Scheduled',
        started: '2025-08-21T11:00:00Z',
        ended: '',
        duration: 0,
        uuid: 'sig-4',
      },
    ];

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
  navigateToItem(`/services/signals/${signal.uuid}`);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(signal: Signal) {
  openLinkInNewTab(`/services/signals/${signal.uuid}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('services');
  currentPage.value = 1;
  await loadSignals(false);
});
</script>
