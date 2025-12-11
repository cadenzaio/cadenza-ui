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

              <div v-if="signalPayload && signalPayload.emission" style="margin-top:8px;">
                <strong>Emission Data</strong>
                <pre :style="jsonPreStyle">{{ JSON.stringify(signalPayload.emission.data ?? signalPayload.emission, null, 2) }}</pre>
              </div>
              <div v-else style="margin-top:8px;color:#666">No emission data available.</div>
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
import { useRouter } from 'vue-router';
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
import { useAppStore } from '~/stores/app';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { useFetch } from '#app';

const appStore = useAppStore();
onMounted(() => {
  appStore.setCurrentSection('serviceActivity');
});

const route = useRoute();
const router = useRouter();
const { openLinkInNewTab } = useOpenLinkInNewTab();
const navigateToItem = (path: string) => {
  if (!path) return;
  router.push(path);
};

function onItemSelected(item: any) {
  if (!item) return;
  const id = item.uuid || item.id || item.name;
  if (!id) return;

  if (String(id).startsWith('signal::')) {
    return;
  }

  const execId = item.uuid || item.id || item.executionId || item.task_execution_id || item.taskExecutionId || id;
  navigateToItem(`/activity/tasks/${execId}`);
}
const flowItems = ref<any[]>([]);
const signalPayload = ref<any | null>(null);
const signalMeta = ref<any | null>(null);
const { isDarkMode } = storeToRefs(useAppStore());

const jsonPreStyle = computed(() => {
  if (isDarkMode.value) {
    return {
      'max-height': '240px',
      overflow: 'auto',
      background: '#1e1e1e',
      color: '#e6eef6',
      padding: '8px',
      'border-radius': '6px',
      marginTop: '6px',
      fontSize: '13px',
    } as Record<string, string>;
  }
  return {
    'max-height': '240px',
    overflow: 'auto',
    background: '#f7f7f7',
    color: '#20242c',
    padding: '8px',
    'border-radius': '6px',
    marginTop: '6px',
    fontSize: '13px',
  } as Record<string, string>;
});

const signalDetails = computed(() => {
  const p = signalPayload.value;
  if (!p) return null as any;
  const emission = p.emission ?? p;
  const meta = signalMeta.value;
  return {
    name: emission.signal_name ?? emission.name ?? p.name ?? '',
    domain: meta?.domain ?? emission.domain ?? emission.signal_domain ?? p.domain ?? '',
    action: meta?.action ?? emission.action ?? p.action ?? '',
    service_name: meta?.service_name ?? emission.service_name ?? p.service_name ?? p.service ?? '',
    created: emission.created ?? emission.created_at ?? p.created ?? p.timestamp ?? '',
  } as any;
});

const formattedCreatedAt = computed(() => {
  const s: any = signalDetails.value;
  if (!s || !s.created) return '';
  try {
    const d = new Date(s.created);
    return isNaN(d.getTime()) ? String(s.created) : d.toLocaleString();
  } catch (e) {
    return String(s.created);
  }
});

async function loadSignalFlow() {
  const id = route.params.id as string | undefined;
  if (!id) return;

  const { data, error } = await useFetch(`/api/activity/signals/${id}`);
  if (error.value) {
    console.error('Failed to fetch signal data', error.value);
    return;
  }

  const payload: any = data.value ?? {};
  signalPayload.value = payload;
  // Try to load signal metadata (domain/action) from services registry
  try {
    const emissionLocal = payload.emission || {};
    const sigName = emissionLocal.signal_name || emissionLocal.name || null;
    const svcName = emissionLocal.service_name || emissionLocal.service || null;
    if (sigName && svcName) {
      const metaResp = await useFetch(`/api/services/signals/${encodeURIComponent(String(sigName))}`, {
        params: { serviceName: svcName }
      });
      // api returns array of signals for that name+service; pick first
      const m = metaResp.data?.value ?? metaResp.data ?? null;
      if (m) {
        signalMeta.value = Array.isArray(m) ? (m[0] || null) : m;
      }
    }
  } catch (e) {
    // non-fatal
    console.debug('Could not load signal metadata:', e);
  }
  const items: any[] = [];

  const pushed = new Set<string>();
  const pushNode = (node: any) => {
    const nid = node.id || node.uuid || node.name;
    if (!nid) return;
    if (pushed.has(String(nid))) return;
    pushed.add(String(nid));
    items.push({ ...node, id: nid, name: nid, uuid: nid });
  };

  const emission = payload.emission;
  const previousTasks = payload.previousTasks ?? [];
  for (const pt of previousTasks) {
    const idField = (pt.task_execution?.uuid ?? pt.task_execution?.id ?? pt.task_execution) || pt.task_name;
    pushNode({
      id: idField,
      label: pt.task_name || pt.task_execution?.task_name || pt.task_execution?.name || 'emitter',
      name: pt.task_name || pt.task_execution?.task_name,
      description: pt.task_meta?.description || '',
      previousId: pt.relation === 'predecessor' ? undefined : undefined,
    });
  }

  if (emission) {
    const sigId = `signal::${emission.uuid}`;
    pushNode({ id: sigId, label: emission.signal_name || 'signal', description: emission.data || '', signal: true, previousId: previousTasks.length > 0 ? (previousTasks[0].task_execution?.uuid ?? previousTasks[0].task_execution ?? previousTasks[0].task_name) : undefined });

    const consumptions = payload.consumptions ?? [];
    for (const c of consumptions) {
      const consumerExecId = c.task_execution_id || c.task_execution || c.taskExecutionId || `${c.task_name}-${c.task_execution_id}`;
      pushNode({ id: consumerExecId, label: c.task_name || consumerExecId, name: c.task_name, description: '', previousId: sigId });

      const consumerDetails = (payload.consumerDetails || []).find((cd: any) => cd.consumption && String(cd.consumption.uuid || cd.consumption.id || cd.consumption.signal_emission_id || '') === String(c.uuid || c.id || c.signal_emission_id || '')) || null;
      const cdMatch = consumerDetails || (payload.consumerDetails || []).find((cd: any) => cd.consumer_execution && String(cd.consumer_execution.uuid) === String(consumerExecId));
      if (cdMatch && Array.isArray(cdMatch.successors)) {
        for (const s of cdMatch.successors) {
          const succId = (s.task_execution?.uuid ?? s.task_execution?.id ?? s.task_execution) || s.task_name || `${s.task_name}-${s.task_execution}`;
          pushNode({ id: succId, label: s.task_name || succId, name: s.task_name, description: s.task_meta?.description || '', previousId: consumerExecId });
        }
      }
    }
  }

  flowItems.value = items;
}

onMounted(() => {
  loadSignalFlow();
});
</script>
