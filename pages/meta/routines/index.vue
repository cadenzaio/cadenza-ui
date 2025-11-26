<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Meta Routines </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="routines"
          row-key="uuid"
          @inspect-row="inspectRoutines"
          @inspect-row-in-new-tab="inspectInNewTab"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          @load-more="loadMoreRoutines"
        />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useFetch } from '#app';
import { useRouter } from '#vue-router';
import { useAppStore } from '~/stores/app';

interface routines {
  type: string;
  label: string;
  service: string;
  executionId: any;
  progress: any;
  uuid: string;
}

const layout = 'dashboard-layout';
const selectedRoutine = ref<routines[] | undefined>(undefined);
const routines = ref<routines[]>([]);
const hasMoreData = ref(true);
const currentPage = ref(1);
const pageSize = 50;
const router = useRouter();

const columns = [
  {
    name: 'label',
    label: 'Name',
    field: 'label',
    required: true,
    sortable: true,
  },
  {
    name: 'version',
    label: 'Version',
    field: 'version',
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
];


function inspectRoutines(routines: routines) {
  const path = `/meta/routines/${encodeURIComponent(String(routines.label))}`;
  const qs: string[] = [];
  // If the routine row contains service/version (from server) pass them through
  if ((routines as any).service) qs.push(`service=${encodeURIComponent(String((routines as any).service))}`);
  if ((routines as any).version) qs.push(`version=${encodeURIComponent(String((routines as any).version))}`);
  navigateToItem(qs.length > 0 ? `${path}?${qs.join('&')}` : path);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(routine: routines) {
  const path = `/meta/routines/${encodeURIComponent(String(routine.label))}`;
  const qs: string[] = [];
  if ((routine as any).service) qs.push(`service=${encodeURIComponent(String((routine as any).service))}`);
  if ((routine as any).version) qs.push(`version=${encodeURIComponent(String((routine as any).version))}`);
  openLinkInNewTab(qs.length > 0 ? `${path}?${qs.join('&')}` : path);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

async function loadRoutines(page: number = 1, append: boolean = false) {
  try {
    const response = await fetch(
      `/api/meta/routines/metaRoutines?page=${page}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    if (append) {
      routines.value = [...routines.value, ...data];
    } else {
      routines.value = data;
    }

    hasMoreData.value = data.length === pageSize;
  } catch (error) {
    console.error('Error loading routines:', error);
    hasMoreData.value = false;
  }
}

async function loadMoreRoutines() {
  currentPage.value++;
  await loadRoutines(currentPage.value, true);
}

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');
  await loadRoutines(1, false);
});
</script>
