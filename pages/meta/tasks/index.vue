<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Meta Task executions </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="tasks"
          row-key="uuid"
          @inspect-row="inspectTask"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreTasks"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        />
        <FrequencyPieChart v-if="tasks.length > 0" :values="tasks" />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '~/stores/app';
import { useRouter } from '#vue-router';

interface Task {
  uuid: string;
  name: string;
  status: string;
  progress: number;
  started: string;
  ended: string;
  duration: number;
}

const tasks = ref<Task[]>([]);
const currentPage = ref(1);
const pageSize = 50;
const hasMoreData = ref(true);
const loadingMoreData = ref(false);

const columns = [
  { name: 'name', label: 'Name', field: 'name', required: true },
  { name: 'status', label: 'Status', field: 'status', required: true },
  { name: 'progress', label: 'Progress', field: 'progress', required: true },
  { name: 'started', label: 'Started', field: 'started', required: true },
  { name: 'ended', label: 'Ended', field: 'ended', required: true },
  { name: 'duration', label: 'Duration (sec)', field: 'duration', required: true },
];

const router = useRouter();

function inspectTask(task: Task) {
  navigateToItem(`/meta/tasks/${task.uuid}`);
}

function inspectInNewTab(task: Task) {
  const url = `/meta/tasks/${task.uuid}`;
  window.open(url, '_blank');
}

function navigateToItem(route: string) {
  router.push(route);
}

async function loadTasks(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }

    const response = await fetch(
      `/api/meta/tasks/metaTasks?page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Failed to fetch tasks');

    const data = await response.json();

    if (isLoadMore) {
      tasks.value = [...tasks.value, ...data.tasks];
    } else {
      tasks.value = data.tasks;
    }

    hasMoreData.value = data.tasks.length === pageSize;
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
  await loadTasks();
});
</script>
