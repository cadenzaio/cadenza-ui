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
                      traceContext?.input_context
                        ? JSON.stringify(traceContext.input_context, null, 2)
                        : ''
                    }}</pre>
                  </div>
                </template>
              </InfoCard>
              <InfoCard>
                <template #title>Output Context</template>
                <template #info>
                  <div class="q-mx-md q-my-sm">
                    <pre>{{
                      traceContext?.output_context
                        ? JSON.stringify(traceContext.output_context, null, 2)
                        : ''
                    }}</pre>
                  </div>
                </template>
              </InfoCard>
            </div>
          </div>
        </div>
        <div class="row q-mx-md">
          <Table
            class="custom-table"
            :columns="columns"
            :rows="routines"
            row-key="uuid"
            @inspect-row="inspectRoutine"
            @inspect-row-in-new-tab="inspectInNewTab"
            @loadMoreData="loadMoreRoutines"
            :enableInfiniteScroll="true"
            :hasMoreData="hasMoreData"
            :loadingMoreData="loadingMoreData"
          >
            <template #title>
              Active Executions ({{ routines.length }} found)
            </template>
          </Table>
          <div v-if="isLoading" class="q-pa-md text-center">
            Loading active executions...
          </div>
          <div v-else-if="error" class="q-pa-md text-center text-negative">
            Error: {{ error }}
          </div>
          <div
            v-else-if="routines.length === 0"
            class="q-pa-md text-center text-grey-6"
          >
            No active executions found for this trace.
          </div>
        </div>
      </div>
      <q-dialog v-model="showGenerateDialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">Confirm Generate</div>
            <div>Are you sure you want to generate a trace?</div>
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
import { Style } from '#components';

function formatDate(date: string) {
  const datetime = new Date(date);
  return `${datetime.toDateString()} ${datetime.toLocaleTimeString()}`;
}

const showGenerateDialog = ref(false);
const traceContext = ref<any>(null);
const routines = ref<any[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const router = useRouter();
const route = useRoute();
const selectedOption = ref('routineMap');
const routineMap = ref<any>([]);
const rangedTimelineItems = ref<any[]>([]);
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const columns = [
  {
    name: 'label',
    label: 'Name',
    field: 'label',
    required: true,
    sortable: true,
  },
  {
    name: 'description',
    label: 'Description',
    field: 'description',
    required: true,
    sortable: false,
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
const timelineItems = computed(() => {
  const services = routineMap.value?.servers || [];
  const routines = routineMap.value?.routines || [];
  const tasks = routineMap.value?.tasks || [];

  const serviceItems = services.map((service: any) => ({
    label: service.processing_graph || service.label || service.uuid,
    nodeType: 'service',
    started: service.created || '',
    ended: service.modified || '',
    description: service.description || '',
    id: service.uuid,
    timelineType: 'heading',
    ...service,
  }));

  const routineItems = routines.map((routine: any) => ({
    label: routine.description || routine.label || routine.uuid,
    nodeType: 'routine',
    started: routine.created || '',
    ended: routine.ended || '',
    description: routine.description || '',
    id: routine.uuid,
    parentNode: routine.server_id,
    timelineType: 'heading',
    ...routine,
  }));

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

  const allItems = [...serviceItems, ...routineItems, ...taskItems];
  return allItems.sort((a: any, b: any) => {
    const aTime = a.started ? new Date(a.started).getTime() : 0;
    const bTime = b.started ? new Date(b.started).getTime() : 0;
    return aTime - bTime;
  });
});
function inspectRoutine(routine: any) {
  router.push(`/activity/routines/${routine.uuid}`);
}
function inspectInNewTab(routine: any) {
  const url = `/activity/routines/${routine.uuid}`;
  window.open(url, '_blank');
}
const isRoutinesLoading = ref(false);
async function loadRoutines(isLoadMore = false) {
  if (isRoutinesLoading.value) return;
  isRoutinesLoading.value = true;
  const traceId = route.params.id;
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    } else {
      currentPage.value = 1;
    }
    const routinesResponse = await fetch(
      `/api/activity/routines/activeRoutines?traceId=${traceId}&page=${currentPage.value}&limit=${pageSize}`
    );
    if (!routinesResponse.ok) {
      const errMsg = `[loadRoutines] Routines response not ok: ${routinesResponse.status} ${routinesResponse.statusText}`;
      error.value = errMsg;
      throw new Error(errMsg);
    }
    const routinesData = await routinesResponse.json();
    if (isLoadMore) {
      routines.value = [...routines.value, ...(routinesData.routines || [])];
    } else {
      routines.value = routinesData.routines || [];
    }
    routineMap.value = routinesData.routineMap || [];
    hasMoreData.value = (routinesData.routines || []).length === pageSize;
  } catch (err) {
    hasMoreData.value = false;
    if (!error.value)
      error.value = err instanceof Error ? err.message : String(err);
  } finally {
    if (isLoadMore) loadingMoreData.value = false;
    isRoutinesLoading.value = false;
  }
}
async function loadMoreRoutines() {
  if (!isRoutinesLoading.value && hasMoreData.value) await loadRoutines(true);
}
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
