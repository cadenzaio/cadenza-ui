<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Routines </template>
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
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

const layout = 'dashboard-layout';
const selectedRoutine = ref<routines[] | undefined>(undefined);

const columns = [
  {
    name: 'label',
    label: 'Name',
    field: 'label',
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

const routines = ref<routines[]>([]);
const hasMoreData = ref(true);

const currentPage = ref(1);
const pageSize = 50;

const router = useRouter();

function inspectRoutines(routines: routines) {
  navigateToItem(`/system/routines/${routines.uuid}`);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(routine: routines) {
  openLinkInNewTab(`/system/routines/${routine.uuid}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

async function loadRoutines(page: number = 1, append: boolean = false) {
  try {
    const response = await fetch(
      `/api/services/routines/routines?page=${page}&limit=${pageSize}`
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
  appStore.setCurrentSection('system');
  await loadRoutines(1, false);
});
</script>
