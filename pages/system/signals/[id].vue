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

// Set current section to 'services' for correct node coloring
const appStore = useAppStore();
onMounted(() => {
  appStore.setCurrentSection('system');
});

// Hardcoded flow: Task 1 -> Signal -> Task 2 (no signal -> task 1 edge)
const flowItems = ref<any[]>([]);

const route = useRoute();
const rawId = computed(() => String(route.params.id ?? '').replace(/\+/g, ' '));

// Fetch signal flow (the API may return either an items array or an object with previousTasks)
const { data: apiData, pending, error } = await useAsyncData(
  () => `signal-flow-${rawId.value}`,
  () => $fetch(`/api/services/signals/${encodeURIComponent(rawId.value)}`)
);

function makeTaskId(name: string) {
  return `task-${name}`;
}

function makeSignalId(name: string) {
  return `signal-${String(name).replace(/[^a-zA-Z0-9-_]/g, '-')}`;
}

// Build flowItems from API response
if (apiData.value) {
  const resp: any = apiData.value;
  if (Array.isArray(resp)) {
    flowItems.value = resp;
  } else if (resp.signal) {
    const items: any[] = [];
    const prev = resp.previousTasks || [];
    // Emitters
    for (const t of prev) {
      items.push({
        id: makeTaskId(t.name),
        name: t.name,
        label: t.label || t.name,
        description: t.description || '',
        previousId: undefined,
      });
    }
    // Signal
    const sid = makeSignalId(resp.signal.name || rawId.value);
    items.push({
      id: sid,
      name: resp.signal.name || rawId.value,
      label: resp.signal.name || rawId.value,
      description: resp.signal.description || resp.signal.domain || '',
      signal: true,
      previousId: prev.length === 1 ? makeTaskId(prev[0].name) : prev.map((p: any) => makeTaskId(p.name)),
    });
    // Consumers (if the API included them as nextTasks or similar, fallback to resp.nextTasks)
    const consumers = resp.nextTasks || [];
    for (const c of consumers) {
      items.push({
        id: makeTaskId(c.name),
        name: c.name,
        label: c.label || c.name,
        description: c.description || '',
        previousId: sid,
      });
    }
    flowItems.value = items;
  } else {
    // Fallback: if API returned object but not expected shape, attempt to use items property
    flowItems.value = resp.items || [];
  }
}
</script>
