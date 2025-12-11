<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>{{ signalDetails?.name ?? '—' }}</template>
        <div>
          <FlowMap :items="flowItems" @item-selected="onItemSelected" />
        <InfoCard>
          <template #title> Signal Data </template>
          <template #info>
            <div>
              <div><strong>Name:</strong> {{ signalDetails?.name ?? '—' }}</div>
              <div><strong>Domain:</strong> {{ signalDetails?.domain ?? 'N/A' }}</div>
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

interface Task {
  task_name: string;
  task_description: string;
}

const appStore = useAppStore();
onMounted(() => {
  appStore.setCurrentSection('meta');
});

const flowItems = ref<any[]>([]);
const route = useRoute();
const router = useRouter();

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

if (apiData.value) {
  const resp: any = apiData.value;
  if (Array.isArray(resp)) {
    flowItems.value = resp.flatMap(signal => {
      const sid = makeSignalId(signal.name);
      const signalNode = {
        id: sid,
        name: sid,
        label: signal.name,
        description: signal.domain || '',
        signal: true
      };

      const previousIds = (signal.previousTasks || []).map((task: Task) =>
        makeTaskId(task.task_name)
      );

      if (previousIds.length > 0) {
        (signalNode as any).previousId = previousIds.length === 1 ? previousIds[0] : previousIds;
      }

      const previousTaskNodes = (signal.previousTasks || []).map((task: Task) => ({
        id: makeTaskId(task.task_name),
        name: makeTaskId(task.task_name),
        label: task.task_name,
        description: task.task_description || ''
      }));

      const nextTaskNodes = (signal.nextTasks || []).map((task: Task) => ({
        id: makeTaskId(task.task_name),
        name: makeTaskId(task.task_name),
        label: task.task_name,
        description: task.task_description || '',
        previousId: sid
      }));

      return [signalNode, ...previousTaskNodes, ...nextTaskNodes];
    });
  } else {
    flowItems.value = resp.items || [];
  }
}

const signalDetails = computed(() => {
  if (!apiData.value) return null as any;
  const resp: any = apiData.value;
  if (Array.isArray(resp)) {
    const match = resp.find((s: any) => s.name === route.params.id);
    return match || resp[0] || null;
  }
  return resp || null;
});

const formattedCreatedAt = computed(() => {
  const s = signalDetails.value;
  if (!s || !s.created) return '';
  try {
    const d = new Date(s.created);
    return isNaN(d.getTime()) ? String(s.created) : d.toLocaleString();
  } catch (e) {
    return String(s.created);
  }
});

function onItemSelected(item: any) {
  if (!item) return;
  if (item.signal === true) return;
  const canonical = item.name || item.id || item.uuid || '';
  if (!canonical) return;
  const taskName = String(canonical).replace(/^task-/, '');
  if (!taskName) return;
  router.push(`/meta/tasks/${encodeURIComponent(String(taskName))}`);
}
</script>
