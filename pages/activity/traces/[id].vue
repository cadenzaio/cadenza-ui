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
                    Created at:
                    {{ traceContext?.created ? formatDate(traceContext.created) : (traceContext?.trace_created ? formatDate(traceContext.trace_created) : '') }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Issued:
                    {{ traceContext?.issued ? formatDate(traceContext.issued) : (traceContext?.issued === null ? '' : traceContext?.issued) }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Service Name: {{ traceContext?.service_name || traceContext?.serviceName || '' }}
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
import { ref, onMounted, watch } from 'vue';
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
const timelineItems = ref<any[]>([]);
const rangedTimelineItems = ref<any[]>([]);

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
    // Use server-provided timeline mappings when available
    timelineItems.value = data.timelineItems || data.timeline || [];
    rangedTimelineItems.value = data.rangedTimelineItems || data.rangedTimeline || [];
    console.log('[id.vue] received timelineItems:', timelineItems.value.length, 'ranged:', rangedTimelineItems.value.length);
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
