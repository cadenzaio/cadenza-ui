<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        Trace Elements
        <q-btn color="primary" @click="showGenerateDialog = true"
          >Regenerate Trace</q-btn
        >
      </template>
      <div>
        <div class="q-pa-md">
          <q-tabs
            v-model="selectedOption"
            dense
            class="text-grey-9 bg-transparent"
            active-color="primary"
            indicator-color="primary"
            align="justify"
            narrow-indicator
          >
            <q-tab name="routineMap" label="Map" />
            <q-tab name="timeline" label="Timeline" />
            <q-tab name="rangedTimeline" label="Ranged Timeline" />
          </q-tabs>

          <q-separator />

          <transition
            name="fade"
            mode="out-in"
            :duration="{ enter: 600, leave: 400 }"
          >
            <div v-show="selectedOption === 'routineMap'">
              <NestedFlowMap
                v-if="nodes.length > 0"
                :nodes="nodes"
                :edges="edges"
                @item-selected="handleNodeSelected"
              />
            </div>
          </transition>
          <transition
            name="fade"
            mode="out-in"
            :duration="{ enter: 500, leave: 300 }"
          >
            <div v-show="selectedOption === 'timeline'">
              <Timeline :itemMap="timelineItems" />
            </div>
          </transition>

          <transition
            name="fade"
            mode="out-in"
            :duration="{ enter: 500, leave: 300 }"
          >
            <div v-show="selectedOption === 'rangedTimeline'">
              <ApexTimeline :itemMap="rangedTimelineItems" />
            </div>
          </transition>
        </div>
      </div>
      <div>
        <div>
          <div class="justify-around flex w-full gap-4">
            <InfoCard>
              <template #title>
                {{ traceContext?.name || 'Trace Info' }}
              </template>
              <template #info>
                <div class="flex-column full-width">
                  <div class="q-mx-md q-my-sm">
                    Issued at:
                    {{
                      traceContext?.issued
                        ? formatDate(traceContext.issued)
                        : ''
                    }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Fulfilled:
                    <span
                      :class="
                        traceContext?.fulfilled
                          ? 'text-positive'
                          : 'text-negative'
                      "
                    >
                      {{ traceContext?.fulfilled ? 'Yes' : 'No' }}
                    </span>
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Fulfilled at:
                    {{
                      traceContext?.fulfilled_at
                        ? formatDate(traceContext.fulfilled_at)
                        : ''
                    }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Description: {{ traceContext?.description }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Trace UUID: {{ traceContext?.uuid }}
                  </div>
                </div>
              </template>
            </InfoCard>
            <div>
              <InfoCard>
                <template #title>Input Context</template>
                <template #info>
                  <div class="q-mx-md q-my-sm">
                    <pre>{{
                      traceContext
                        ? JSON.stringify(traceContext, null, 2)
                        : ''
                    }}</pre>
                  </div>
                </template>
              </InfoCard>
              
            </div>
          </div>
        </div>
       
      </div>
      <q-dialog v-model="showGenerateDialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">Confirm Generate</div>
            <div>Are you sure you want to generate a trace?</div>
            <div style="color: red;">In development not functional</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              label="Cancel"
              color="primary"
              @click="showGenerateDialog = false"
            />
            <q-btn
              flat
              label="Confirm"
              color="secondary"
              @click="confirmGenerate"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useFetch, useRoute } from '#app';
import { useRouter } from '#vue-router';
import NestedFlowMap from '~/components/NestedFlowMap.vue';
import { useAppStore } from '~/stores/app';

function formatDate(date: string) {
  const datetime = new Date(date);
  return `${datetime.toDateString()} ${datetime.toLocaleTimeString()}`;
}

const showGenerateDialog = ref(false);
const traceContext = ref<any>(null);
const routines = ref<any[]>([]);
const error = ref<string | null>(null);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const router = useRouter();
const route = useRoute();
const selectedOption = ref('routineMap');
const routineMap = ref<any>([]);
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const timelineItems = computed(() => {
const services = routineMap.value?.servers || [];
const routines = routineMap.value?.routines || [];
const tasks = routineMap.value?.tasks || [];

  if ((services.length + routines.length + tasks.length) > 0) {
    const taskItems = tasks.map((task: any) => ({
      label: task.task_name || task.label || task.uuid,
      nodeType: 'task',
      started: task.started || task.created || '',
      ended: task.ended || '',
      description: task.description || '',
      id: task.uuid,
      parentNode: task.routine_execution_id,
      timelineType: 'body',
      ...task,
    }));

    return taskItems.sort((a: any, b: any) => {
      const aTime = a.started ? new Date(a.started).getTime() : 0;
      const bTime = b.started ? new Date(b.started).getTime() : 0;
      return aTime - bTime;
    });
  }

  const mapped = nodes.value.map((n: any) => {
    const d = n.data || {};
    const common = {
      label: d.label || n.id,
      nodeType: n.nodeType || d.nodeType || 'task',
      description: d.description || d.label || '',
      id: n.id,
      uuid: d.uuid || n.id,
      parentNode: n.parentNode || d.parentNode || null,
      created: d.created || null,
      started: d.started || d.created || null,
      ended: d.ended || null,
      raw: d,
    };

    return {
      ...common,
      timelineType: n.nodeType === 'service' || n.nodeType === 'routine' ? 'heading' : 'body',
      ...d,
    };
  });

  const filtered = mapped.filter((m: any) => {
    const t = (m.nodeType || '').toString().toLowerCase();
    return t === 'task' || t === 'signal';
  });

  return filtered.sort((a: any, b: any) => {
    const aTime = a.started ? new Date(a.started).getTime() : 0;
    const bTime = b.started ? new Date(b.started).getTime() : 0;
    return aTime - bTime;
  });
});

const rangedTimelineItems = computed(() => {
  return timelineItems.value.map((it: any) => ({
    label: it.label,
    uuid: it.uuid || it.id,
    name: it.label,
    started: it.started || it.created || null,
    created: it.created || null,
    ended: it.ended || null,
    progress: it.progress || 0,
    errored: it.errored || false,
    failed: it.failed || false,
    isComplete: it.isComplete || false,
    layer_index: it.layer_index || 0,
    description: it.description || it.raw?.description || null,
    signal: it.raw?.signal || it.signal || false,
    type: it.raw?.type || it.type || null,
  }));
});

function confirmGenerate() {
  showGenerateDialog.value = false;
}
async function fetchTraceData(traceId: string) {
  try {
    const response = await fetch(`/api/activity/traces/trace?uuid=${traceId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch trace data: ${response.statusText}`);
    }
    const data = await response.json();
    nodes.value = data.nodes;
    edges.value = data.edges;
    traceContext.value = data.context ?? null;
  } catch (error) {
    console.error('Error fetching trace data:', error);
  }
}
async function loadAllData() {
  let traceId = route.params.id;
  if (Array.isArray(traceId)) traceId = traceId[0];
  await fetchTraceData(traceId);
}
onMounted(loadAllData);
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId !== oldId) loadAllData();
  }
);
watch(
  edges,
  (newEdges) => {
    console.log('[id.vue] Edges updated:', newEdges);
  },
  { deep: true }
);
watch(
  nodes,
  (newNodes) => {
  },
  { deep: true }
);

onMounted(() => {
});

const appStore = useAppStore();
function handleNodeSelected(node: any) {
  const clickedNode = node?.node || node;
  const base = appStore.currentSection || 'system';

  if (clickedNode.nodeType === 'task') {
    const taskId = clickedNode.id || clickedNode.data?.uuid || clickedNode.data?.id;
    if (taskId) {
      router.push(`/activity/tasks/${encodeURIComponent(taskId)}`);
    }
  } else if (clickedNode.nodeType === 'signal') {
   const signalId = clickedNode.data?.uuid || clickedNode.data?.id;
    if (signalId) {
      router.push(`/activity/signals/${encodeURIComponent(signalId)}`);
    }
  } else if (clickedNode.nodeType === 'service') {
    const serviceId = clickedNode.id || clickedNode.data?.uuid || clickedNode.data?.id;
    if (serviceId) {
      router.push(`/activity/services/${encodeURIComponent(serviceId)}`);
    }
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
.custom-table {
  background-color: #e6b30dc4;
}
</style>
