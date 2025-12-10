<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Meta Tasks </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="tasks"
          row-key="name"
          @inspect-row="inspectTasks"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreTasks"
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

interface tasks {
  type: string;
  label: string;
  description: string;
  id: any;
  executionId: any;
  progress: any;
  service: string;
  unique: boolean;
  concurrency: number;
  name: string;
}

const layout = 'dashboard-layout';
const selectedTask = ref<tasks[] | undefined>(undefined);
watch(selectedTask, (newValue) => {});

const columns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
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
  {
    name: 'unique',
    label: 'Unique',
    field: 'unique',
    required: true,
    sortable: true,
  },
];

const tasks = ref<tasks[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);

const currentPage = ref(1);
const pageSize = 50;

const router = useRouter();

function inspectTasks(tasks: tasks) {
  const path = `/meta/tasks/${encodeURIComponent(String(tasks.name))}`;
  const qs = [];
  if ((tasks as any).version) qs.push(`version=${encodeURIComponent(String((tasks as any).version))}`);
  if (tasks.service) qs.push(`service=${encodeURIComponent(String(tasks.service))}`);
  navigateToItem(qs.length > 0 ? `${path}?${qs.join('&')}` : path);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(tasks: tasks) {
  const path = `/meta/tasks/${encodeURIComponent(String(tasks.name))}`;
  const qs = [];
  if ((tasks as any).version) qs.push(`version=${encodeURIComponent(String((tasks as any).version))}`);
  if (tasks.service) qs.push(`service=${encodeURIComponent(String(tasks.service))}`);
  openLinkInNewTab(qs.length > 0 ? `${path}?${qs.join('&')}` : path);
}

const navigateToItem = (route: string) => {
  router.push(route);
};

async function loadTasks(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const response = await fetch(
      `/api/meta/tasks/metaTasks?page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    if (isLoadMore) {
      tasks.value = [...tasks.value, ...data];
    } else {
      tasks.value = data;
    }

    hasMoreData.value = data.length === pageSize;
  } catch (error) {
    console.error('Error loading tasks:', error);
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
  }
}

async function loadMoreTasks() {
  await loadTasks(true);
}


onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');
  currentPage.value = 1;
  await loadTasks(false);
});
</script>
