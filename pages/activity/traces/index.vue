<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Traces </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="Traces"
          row-key="uuid"
          @inspect-row="inspectTraces"
          @inspect-row-in-new-tab="inspectInNewTab"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          @load-more="loadMoreTraces"
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

interface Traces {
  type: string;
  label: string;
  service: string;
  executionId: any;
  progress: any;
  uuid: string;
}

const layout = 'dashboard-layout';
const selectedRoutine = ref<Traces[] | undefined>(undefined);
const Traces = ref<Traces[]>([]);
const hasMoreData = ref(true);
const currentPage = ref(1);
const pageSize = 50;
const router = useRouter();

const columns = [
  {
    name: 'uuid',
    label: 'UUID',
    field: 'uuid',
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


function inspectTraces(Traces: Traces) {
  navigateToItem(`/activity/Traces/${Traces.uuid}`);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(routine: Traces) {
  openLinkInNewTab(`/activity/Traces/${routine.uuid}`);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

async function loadTraces(page: number = 1, append: boolean = false) {
  try {
    const response = await fetch(
      `/api/activity/traces/traces?page=${page}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    if (append) {
      Traces.value = [...Traces.value, ...data];
    } else {
      Traces.value = data;
    }

    hasMoreData.value = data.length === pageSize;
  } catch (error) {
    console.error('Error loading Traces:', error);
    hasMoreData.value = false;
  }
}

async function loadMoreTraces() {
  currentPage.value++;
  await loadTraces(currentPage.value, true);
}

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
  await loadTraces(1, false);
});
</script>
