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
import { ref, onMounted } from 'vue';
import { useAppStore } from '~/stores/app';

// Set current section to 'services' for correct node coloring
const appStore = useAppStore();
onMounted(() => {
  appStore.setCurrentSection('system');
});

// Hardcoded flow: Task 1 -> Signal -> Task 2 (no signal -> task 1 edge)
const flowItems = ref([
  {
    id: 'task-10',
    label: 'Task 10',
    description: 'First task',
    previousId: undefined,
  },
  {
    id: 'signal-1',
    label: 'Signal',
    description: 'Signal node',
    signal: true,
    previousId: 'task-10',
  },
  {
    id: 'task-12',
    label: 'Task 12',
    description: 'Second task',
    previousId: 'signal-1',
  },
]);
</script>
