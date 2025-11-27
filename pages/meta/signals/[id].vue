<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>Signal Details</template>
        <div>
          <FlowMap :items="flowItems" @item-selected="onItemSelected" />
        <InfoCard>
          <template #title> Signal Data </template>
          <template #info>
            <div>
              <div><strong>Name:</strong> {{ signalDetails?.name ?? '—' }}</div>
              <div><strong>Domain:</strong> {{ signalDetails?.domain ?? 'N/A' }}</div>
              <div><strong>Action:</strong> {{ signalDetails?.action ?? '—' }}</div>
              <div><strong>Service:</strong> {{ signalDetails?.service_name ?? '—' }}</div>
              <div><strong>Created At:</strong> {{ formattedCreatedAt || '—' }}</div>
            </div>
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
import { useRoute, useAsyncData, useRouter } from '#imports';

// Define the Task interface
interface Task {
  task_name: string;
  task_description: string;
}

// Set current section to 'services' for correct node coloring
const appStore = useAppStore();
onMounted(() => {
  appStore.setCurrentSection('meta');
});

// Hardcoded flow: Task 1 -> Signal -> Task 2 (no signal -> task 1 edge)
const flowItems = ref<any[]>([]);

const route = useRoute();
const router = useRouter();

// Fetch signal flow (the API may return either an items array or an object with previousTasks)
const { data: apiData, pending, error } = await useAsyncData(
  () => `signal-flow-${route.params.id}`,
  () => $fetch(`/api/meta/signals/${encodeURIComponent(String(route.params.id))}`, {
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
        // use the generated id as the `name` so FlowMap's getId() resolves to this stable id
        name: sid,
        // keep the human-friendly label separate
        label: signal.name,
        description: signal.domain || '',
        signal: true
      };

      // Build a list of previous task ids (stable ids used by FlowMap)
      const previousIds = (signal.previousTasks || []).map((task: Task) =>
        makeTaskId(task.task_name)
      );

      // Attach previousId(s) to the signal node so FlowMap will create edges from tasks -> signal
      if (previousIds.length > 0) {
        // if only one previous id, keep as single value is also accepted by FlowMap's getPreviousIds
        (signalNode as any).previousId = previousIds.length === 1 ? previousIds[0] : previousIds;
      }

      const previousTaskNodes = (signal.previousTasks || []).map((task: Task) => ({
        id: makeTaskId(task.task_name),
        // store stable id in `name` so getId() resolves to the same identifier
        name: makeTaskId(task.task_name),
        label: task.task_name,
        description: task.task_description || ''
      }));

      const nextTaskNodes = (signal.nextTasks || []).map((task: Task) => ({
        id: makeTaskId(task.task_name),
        name: makeTaskId(task.task_name),
        label: task.task_name,
        description: task.task_description || '',
        // next tasks should have the signal id as their previousId so FlowMap will create edges signal -> task
        previousId: sid
      }));

      return [signalNode, ...previousTaskNodes, ...nextTaskNodes];
    });
  } else {
    // Fallback: if API returned object but not expected shape, attempt to use items property
    flowItems.value = resp.items || [];
  }
}

// Compute a single signal details object for the InfoCard (handles array or single-object responses)
const signalDetails = computed(() => {
  if (!apiData.value) return null as any;
  const resp: any = apiData.value;
  if (Array.isArray(resp)) {
    // prefer exact match to route param, otherwise first element
    const match = resp.find((s: any) => s.name === route.params.id);
    return match || resp[0] || null;
  }
  return resp || null;
});

const formattedCreatedAt = computed(() => {
  const s = signalDetails.value;
  if (!s || !s.created) return '';
  try {
    // Some timestamps come as 'YYYY-MM-DD HH:mm:ss.SSS' or ISO; Date can parse both in most environments
    const d = new Date(s.created);
    return isNaN(d.getTime()) ? String(s.created) : d.toLocaleString();
  } catch (e) {
    return String(s.created);
  }
});

// Handle clicks from FlowMap nodes: navigate to task pages when a task node
// is selected. Signal nodes are ignored here since this page already shows
// signal details.
function onItemSelected(item: any) {
  if (!item) return;
  // Ignore signal nodes
  if (item.signal === true) return;

  // Nodes created in this file use `id`/`name` like `task-<task_name>`
  const canonical = item.name || item.id || item.uuid || '';
  if (!canonical) return;
  const taskName = String(canonical).replace(/^task-/, '');
  if (!taskName) return;
  router.push(`/meta/tasks/${encodeURIComponent(String(taskName))}`);
}
</script>
