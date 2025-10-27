<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Meta Routine executions </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="routines"
          row-key="uuid"
          @inspect-row="inspectRoutine"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreRoutines"
          :hasMoreData="hasMoreData"
          :enableInfiniteScroll="true"
          :loadingMoreData="loadingMoreData"
        />
        <FrequencyPieChart v-if="routines.length > 0" :values="routines" />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useFetch } from '#app';
import { useRouter, viewDepthKey } from '#vue-router';
import { useAppStore } from '~/stores/app';
import { useVirtualList } from '@vueuse/core';

interface Routine {
  type: string;
  label: string;
  description: string;
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

const layout = 'dashboard-layout';
const selectedRoutine = ref<Routine[] | undefined>(undefined);
watch(selectedRoutine, (newValue) => {});

const columns = [
  {
    name: 'name',
    label: 'Name',
    field: 'label',
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
    name: 'progress',
    label: 'Progress',
    field: 'progress',
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

const routines = ref<Routine[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;

const router = useRouter();

function inspectRoutine(routine: Routine) {
  navigateToItem(`/meta/routines/${routine.uuid}`);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(routine: Routine) {
  openLinkInNewTab(`/meta/routines/${routine.uuid}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

async function loadRoutines(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
      console.log(`Loading more routines, current page: ${currentPage.value}`);
    }

    const response = await fetch(
      `/api/meta/routines/metaRoutines?page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    if (isLoadMore) {
      routines.value = [...routines.value, ...data];
    } else {
      routines.value = data;
    }

    hasMoreData.value = data.length === pageSize;
  } catch (error) {
    console.error('Error loading routines:', error);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
}

async function loadMoreRoutines() {
  await loadRoutines(true);
}

// Fetch server stats and set the current section on component mount
onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');
  await loadRoutines();
});
</script>
