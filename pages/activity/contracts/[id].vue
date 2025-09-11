<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        Contract Elements
        <q-btn color="primary" @click="showGenerateDialog = true"
          >Regenerate Contract</q-btn
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
              <ApexTimeline :itemMap="routineMap" />
            </div>
          </transition>
        </div>
      </div>
      <div>
        <div>
          <div class="justify-around flex w-full gap-4">
            <InfoCard>
              <template #title>
                {{ contractContext?.name || 'Contract Info' }}
              </template>
              <template #info>
                <div class="flex-column full-width">
                  <div class="q-mx-md q-my-sm">
                    Issued at:
                    {{
                      contractContext?.issued
                        ? formatDate(contractContext.issued)
                        : ''
                    }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Fulfilled:
                    <span
                      :class="
                        contractContext?.fulfilled
                          ? 'text-positive'
                          : 'text-negative'
                      "
                    >
                      {{ contractContext?.fulfilled ? 'Yes' : 'No' }}
                    </span>
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Fulfilled at:
                    {{
                      contractContext?.fulfilled_at
                        ? formatDate(contractContext.fulfilled_at)
                        : ''
                    }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Description: {{ contractContext?.description }}
                  </div>
                  <div class="q-mx-md q-my-sm">
                    Contract UUID: {{ contractContext?.uuid }}
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
                      contractContext?.input_context
                        ? JSON.stringify(contractContext.input_context, null, 2)
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
                      contractContext?.output_context
                        ? JSON.stringify(
                            contractContext.output_context,
                            null,
                            2
                          )
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
            No active executions found for this contract.
          </div>
        </div>
        <!-- <ContractHeatMap :contractId="String(route.params.id)"/> -->
      </div>
      <q-dialog v-model="showGenerateDialog">
        <q-card>
          <q-card-section>
            <div class="text-h6">Confirm Generate</div>
            <div>Are you sure you want to generate a contract?</div>
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
const contractContext = ref<any>(null);
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
const routineMap = ref([]);
const contractData = ref<any>(null);

const nodes = ref<any[]>([]);

const timelineItems = computed(() => {
  const tasks = routineMap.value?.tasks || [];
  const taskItems = tasks.map((task: any) => ({
    label: task.task_name || task.label || task.uuid,
    nodeType: 'task',
    started: task.started || task.created || '',
    ended: task.ended || '',
    description: task.description || '',
    id: task.uuid,
    parentNode: task.routine_execution_id,
    ...task,
  }));
  return taskItems.sort((a, b) => {
    const aTime = a.started ? new Date(a.started).getTime() : 0;
    const bTime = b.started ? new Date(b.started).getTime() : 0;
    return aTime - bTime;
  });
});

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

function inspectRoutine(routine: any) {
  router.push(`/activity/routines/${routine.uuid}`);
}

function inspectInNewTab(routine: any) {
  const url = `/activity/routines/${routine.uuid}`;
  window.open(url, '_blank');
}

const isRoutinesLoading = ref(false);
async function loadRoutines(isLoadMore = false) {
  if (isRoutinesLoading.value) {
    console.log('[loadRoutines] Prevented concurrent load');
    return;
  }
  isRoutinesLoading.value = true;
  const contractId = route.params.id;
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    } else {
      currentPage.value = 1;
    }
    const routinesResponse = await fetch(
      `/api/activity/routines/activeRoutines?contractId=${contractId}&page=${currentPage.value}&limit=${pageSize}`
    );
    if (!routinesResponse.ok) {
      const errMsg = `[loadRoutines] Routines response not ok: ${routinesResponse.status} ${routinesResponse.statusText}`;
      console.error(errMsg);
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
    console.error('[loadRoutines] Error loading routines:', err);
    hasMoreData.value = false;
    if (!error.value) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (isLoadMore) {
      loadingMoreData.value = false;
    }
    isRoutinesLoading.value = false;
  }
}

async function loadMoreRoutines() {
  if (!isRoutinesLoading.value && hasMoreData.value) {
    await loadRoutines(true);
  }
}

function onTaskSelected(task: any) {}

function confirmGenerate() {
  showGenerateDialog.value = false;
}

async function fetchContractContext(contractId: string) {
  try {
    const contractRes = await fetch(
      `/api/contracts/contracts?uuid=${contractId}`
    );
    if (contractRes.ok) {
      const apiData = await contractRes.json();
      contractData.value = apiData;
      contractContext.value = apiData.contracts?.[0] || null;

      // Set routineMap to the routines, servers, and tasks
      routineMap.value = {
        routines: apiData.routines || [],
        servers: apiData.servers || [],
        tasks: apiData.tasks || [],
      };
      console.log('apiData.tasks:', apiData.tasks);
      console.log('routineMap:', routineMap.value);
      // Build nodes and edges for NestedFlowMap using the raw API data
      const contract = apiData.contracts?.[0];
      const routines = apiData.routines || [];
      const servers = apiData.servers || [];
      const tasks = apiData.tasks || [];

      // Service nodes (no parentNode: contract)
      const serviceNodes = servers.map((srv: any) => ({
        id: srv.uuid,
        type: 'custom',
        nodeType: 'service',
        data: { label: srv.processing_graph, isParent: true },
        created: srv.created || '',
        ended: srv.modified || '',
        // No parentNode
        extent: 'parent',
        expandParent: true,
      }));

      // Routine nodes (parentNode: server)
      const routineNodes = routines.map((routine: any) => ({
        id: routine.uuid,
        type: 'custom',
        nodeType: 'routine',
        data: { label: routine.description, isParent: true },
        parentNode: routine.server_id,
        created: routine.created || '',
        started: routine.created || '',
        ended: routine.ended || '',
        extent: 'parent',
        expandParent: true,
      }));

      // Task nodes (parentNode: routine)
      const taskNodes = tasks.map((task: any) => ({
        id: task.uuid,
        type: 'custom',
        nodeType: 'task',
        data: { label: task.task_name },
        parentNode: task.routine_execution_id,
        created: task.created || '',
        started: task.started || task.created || '',
        ended: task.ended || '',
        extent: 'parent',
        expandParent: true,
        style: { margin: '50px', padding: '10px' },
      }));

      // Build edges using previous_task_execution_id
      const edgesFromPrevious: any[] = [];
      tasks.forEach((task: any) => {
        if (Array.isArray(task.previous_task_execution_id)) {
          task.previous_task_execution_id.forEach((prevId: string) => {
            if (prevId) {
              edgesFromPrevious.push({
                id: `e${prevId}-${task.uuid}`,
                source: prevId,
                target: task.uuid,
              });
            }
          });
        } else if (task.previous_task_execution_id) {
          edgesFromPrevious.push({
            id: `e${task.previous_task_execution_id}-${task.uuid}`,
            source: task.previous_task_execution_id,
            target: task.uuid,
          });
        }
      });
      nodes.value = [...serviceNodes, ...routineNodes, ...taskNodes];
      edges.value = [...edgesFromPrevious];
    } else {
      const errMsg = `[fetchContractContext] Contract response not ok: ${contractRes.status} ${contractRes.statusText}`;
      console.error(errMsg);
      error.value = errMsg;
    }
  } catch (err) {
    console.error(
      '[fetchContractContext] Error fetching contract context:',
      err
    );
    error.value = err instanceof Error ? err.message : String(err);
  }
}

async function loadAllData() {
  let contractId = route.params.id;
  if (Array.isArray(contractId)) contractId = contractId[0];
  isLoading.value = true;
  error.value = null;
  await loadRoutines(false);
  await fetchContractContext(contractId);
  isLoading.value = false;
}

onMounted(loadAllData);

watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      loadAllData();
    }
  }
);
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
