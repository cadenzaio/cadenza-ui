<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>Signal Details</template>
      <div>
        <FlowMap :items="flowItems" />
        <InfoCard>
          <template #title> Signal Data </template>
          <template #info>
            This section displays metadata and details about the selected
            signal.
          </template>
        </InfoCard>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import FlowMap from '~/components/FlowMap.vue';
import { ref, onMounted, computed } from 'vue';
import { useAppStore } from '~/stores/app';
import { useRoute, useAsyncData } from '#imports';

// Define the Task interface
interface Task {
  task_name: string;
  task_description: string;
}

// Set current section to 'services' for correct node coloring
const appStore = useAppStore();
onMounted(() => {
  appStore.setCurrentSection('system');
});

// Hardcoded flow: Task 1 -> Signal -> Task 2 (no signal -> task 1 edge)
const flowItems = ref<any[]>([]);

const route = useRoute();

// Fetch signal flow (the API may return either an items array or an object with previousTasks)
const { data: apiData, pending, error } = await useAsyncData(
  () => `signal-flow-${route.params.id}`,
  () => $fetch(`/api/services/signals/${encodeURIComponent(String(route.params.id))}`, {
    params: {
      signalName: route.params.id,
      serviceName: route.query.serviceName
    }
  })
);

function makeTaskId(name: string) {
  return `task-${name}`;
}

function makeSignalId(name: string) {
  return `signal-${String(name)}`;
}

// Build flowItems from API response
if (apiData.value) {
  const resp: any = apiData.value;
  if (Array.isArray(resp)) {
    flowItems.value = resp.flatMap(signal => {
      const sid = makeSignalId(signal.name);
      const signalNode = {
        id: sid,
        name: signal.name,
        label: signal.name,
        description: signal.domain || '',
        signal: true
      };

      const previousTaskNodes = signal.previousTasks.map((task: Task) => ({
        id: makeTaskId(task.task_name),
        name: task.task_name,
        label: task.task_name,
        description: task.task_description || '',
        previousId: undefined,
        edge: { source: makeTaskId(task.task_name), target: sid }
      }));

      const nextTaskNodes = signal.nextTasks.map((task: Task) => ({
        id: makeTaskId(task.task_name),
        name: task.task_name,
        label: task.task_name,
        description: task.task_description || '',
        previousId: sid,
        edge: { source: sid, target: makeTaskId(task.task_name) }
      }));

      return [signalNode, ...previousTaskNodes, ...nextTaskNodes];
    });
  } else {
    // Fallback: if API returned object but not expected shape, attempt to use items property
    flowItems.value = resp.items || [];
  }
}
</script>
