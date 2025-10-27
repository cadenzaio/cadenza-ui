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
import { useFetch } from '#app';
import { useRouter } from '#vue-router';
import { useAppStore } from '~/stores/app';

interface task {
  name: string;
  type: string;
  label: string;
  description: string;
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

const layout = 'dashboard-layout';
const selectedTask = ref<task[] | undefined>(undefined);
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

const tasks = ref<task[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;

const router = useRouter();

function inspectTask(task: task) {
  navigateToItem(`/activity/tasks/${task.uuid}`);
}
function inspectInNewTab(task: task) {
  const url = `/activity/tasks/${task.uuid}`;
  window.open(url, '_blank');
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
      tasks.value = [...tasks.value, ...data.tasks];
    } else {
      tasks.value = data.tasks;
    }

    hasMoreData.value = data.tasks.length === pageSize;
  } catch (error) {
    console.error('Error fetching tasks:', error);
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
