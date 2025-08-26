<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Tasks </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="tasks"
          row-key="uuid"
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
  uuid: string;
  service: string;
  unique: boolean;
  concurrency: number;
}

const layout = 'dashboard-layout';
const selectedTask = ref<tasks[] | undefined>(undefined);
watch(selectedTask, (newValue) => {});

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
  navigateToItem(`/services/tasks/${tasks.uuid}`);
}
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();

function inspectInNewTab(tasks: tasks) {
  openLinkInNewTab(`/services/tasks/${tasks.uuid}`);
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
      `/api/services/tasks/tasks?page=${currentPage.value}&limit=${pageSize}`
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

// Fetch server stats and set the current section on component mount
onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('services');
  currentPage.value = 1; // Always start at page 1 on mount
  await loadTasks(false);
});
</script>
