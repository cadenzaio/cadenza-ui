<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        Meta {{ selectedItem?.label }} - {{ selectedItem?.uuid.slice(0, 8) }}
        <q-btn color="warning" @click="showGenerateDialog = true">
          Generate Contract
          <q-tooltip anchor="top middle" self="bottom middle">
            Generate a contract from this point
          </q-tooltip>
        </q-btn>
      </template>

      <div>
        <div class="q-pa-md flex-centered">
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

          <div class="centered-container">
            <transition
              name="fade"
              mode="out-in"
              :duration="{ enter: 500, leave: 300 }"
            >
              <div class="flex" v-show="selectedOption === 'routineMap'">
                <div
                  v-if="routineMapLoading"
                  class="flex justify-center items-center"
                  style="min-height: 400px; width: 100%"
                >
                  <q-spinner-dots size="48px" color="primary" />
                </div>
                <FlowMap
                  v-else
                  :items="routineMap"
                  id-field="uuid"
                  label-field="name"
                  previous-field="previousTaskExecutionId"
                  @item-selected="
                    (task) => onTaskSelected(mapTaskToSelectedTask(task))
                  "
                  style="width: 100%"
                />
              </div>
            </transition>

            <transition
              name="fade"
              mode="out-in"
              :duration="{ enter: 500, leave: 300 }"
            >
              <div v-show="selectedOption === 'timeline'">
                <div
                  v-if="routineMapLoading"
                  class="flex justify-center items-center"
                  style="min-height: 400px"
                >
                  <q-spinner-dots size="48px" color="primary" />
                </div>
                <Timeline
                  v-else
                  :itemMap="routineMap"
                  @task-selected="onTaskSelected"
                />
              </div>
            </transition>

            <transition
              name="fade"
              mode="out-in"
              :duration="{ enter: 500, leave: 300 }"
            >
              <div v-show="selectedOption === 'rangedTimeline'">
                <ApexTimeline
                  :itemMap="routineMap"
                  :loading="routineMapLoading"
                  @task-selected="
                    (task) => onTaskSelected(mapTaskToSelectedTask(task))
                  "
                />
              </div>
            </transition>
          </div>
        </div>

        <div class="row q-mx-md justify-around">
          <InfoCard v-if="selectedItem">
            <template #title>
              {{ selectedItem?.label }}
            </template>
            <template #info>
              <div class="flex-column full-width">
                <div class="q-mx-md q-my-sm">
                  Description: {{ selectedItem?.routineDescription }}
                </div>
                <div class="q-mx-md q-my-sm">
                  Executed tasks: {{ routineMap?.length ?? 0 }}
                </div>
                <div class="q-separator" style="height: 2px"></div>

                <div class="flex">
                  <div>
                    <div class="q-mx-md q-my-sm">
                      Progress: {{ selectedItem?.progress }}
                    </div>
                    <div class="q-mx-md q-my-sm">
                      Started: {{ formatDate(selectedItem?.started) }}
                    </div>
                    <div class="q-mx-md q-my-sm">
                      Ended: {{ formatDate(selectedItem?.ended) }}
                    </div>
                    <div class="q-mx-md q-my-sm">
                      Duration:
                      {{
                        getDuration(selectedItem?.started, selectedItem?.ended)
                      }}
                      sec
                    </div>
                  </div>
                  <ProgressRadialBarChart
                    v-if="selectedItem"
                    :name="selectedItem?.label"
                    :value="selectedItem.progress.toString()"
                  />
                </div>

                <div class="q-separator" style="height: 2px"></div>
                <div class="q-mx-md q-my-sm">
                  Status: {{ selectedItem.status }}
                </div>
                <div class="q-separator" style="height: 2px"></div>

                <div
                  v-if="selectedItem?.routineId"
                  class="q-mx-md q-my-sm"
                  @click="
                    navigateToItem(
                      `/services/routines/${selectedItem?.routineId}`
                    )
                  "
                >
                  Routine id:
                  <span class="text-primary cursor-pointer">{{
                    selectedItem?.label
                  }}</span>
                </div>
                <div
                  class="q-mx-md q-my-sm"
                  @click="
                    navigateToItem(
                      `/services/${selectedItem?.serverName?.split('@')[0]}`
                    )
                  "
                >
                  Service id:
                  <span class="text-primary cursor-pointer">{{
                    selectedItem?.serverName
                  }}</span>
                </div>
                <div
                  v-if="selectedItem?.previousRoutineExecution"
                  class="q-mx-md q-my-sm"
                  @click="
                    navigateToItem(
                      `/activity/routines/${selectedItem?.previousRoutineExecution}`
                    )
                  "
                >
                  Previous routine:<span class="text-warning cursor-pointer">
                    {{ selectedItem?.previousRoutineName }}</span
                  >
                </div>
                <div
                  class="q-mx-md q-my-sm"
                  @click="
                    navigateToItem(
                      `/activity/contracts/${selectedItem?.contract_id}`
                    )
                  "
                >
                  <span class="text-warning cursor-pointer">Contract</span>
                </div>
              </div>
            </template>
          </InfoCard>

          <div v-if="selectedTask" ref="flashCard">
            <InfoCard :class="{ 'flash-bg': flashActive }">
              <template #title>
                {{ selectedTask?.name }}
              </template>
              <template #info>
                <div class="flex-column full-width">
                  <div class="q-mx-md q-my-sm">
                    Description: {{ selectedTask?.description }}
                  </div>
                  <div
                    class="q-mx-md q-my-sm"
                    @click="
                      navigateToItem(`/activity/tasks/${selectedTask?.uuid}`)
                    "
                  >
                    Execution id:
                    <span class="text-warning cursor-pointer">{{
                      selectedTask?.label
                    }}</span>
                  </div>
                  <div class="q-separator" style="height: 2px"></div>

                  <div class="flex">
                    <div>
                      <div class="q-mx-md q-my-sm">
                        Progress: {{ selectedTask.progress }}%
                      </div>
                      <div class="q-mx-md q-my-sm">
                        Started: {{ formatDate(selectedTask?.started) }}
                      </div>
                      <div class="q-mx-md q-my-sm">
                        Ended: {{ formatDate(selectedTask?.ended) }}
                      </div>
                      <div class="q-mx-md q-my-sm">
                        Duration:
                        {{
                          getDuration(
                            selectedTask?.started,
                            selectedTask?.ended
                          )
                        }}
                        sec
                      </div>
                    </div>
                    <ProgressRadialBarChart
                      v-if="selectedTask"
                      :key="selectedTask.uuid"
                      :name="selectedTask?.label"
                      :value="selectedTask.progress.toString()"
                    />
                  </div>

                  <div class="q-separator" style="height: 2px"></div>
                  <div class="q-mx-md q-my-sm">
                    Success:
                    {{ !selectedTask?.failed && !selectedTask?.errored }}
                  </div>
                  <div class="q-separator" style="height: 2px"></div>

                  <div
                    v-if="selectedTask?.previousTaskExecutionId"
                    class="q-mx-md q-my-sm"
                    @click="
                      navigateToItem(
                        `/activity/tasks/${selectedTask?.previousTaskExecutionId}`
                      )
                    "
                  >
                    Previous task:
                    <span class="text-warning cursor-pointer">{{
                      selectedTask?.previous_task_name
                    }}</span>
                  </div>
                  <div
                    v-if="selectedTask?.taskId"
                    class="q-mx-md q-my-sm"
                    @click="
                      navigateToItem(`/services/tasks/${selectedTask?.taskId}`)
                    "
                  >
                    Task id:
                    <span class="text-primary cursor-pointer">{{
                      selectedTask?.label
                    }}</span>
                  </div>
                  <div
                    class="q-mx-md q-my-sm"
                    @click="
                      navigateToItem(
                        `/services/${selectedItem?.serverName?.split('@')[0]}`
                      )
                    "
                  >
                    Server id:
                    <span class="text-primary cursor-pointer">{{
                      selectedItem?.serverName
                    }}</span>
                  </div>
                </div>
              </template>
            </InfoCard>
          </div>

          <div>
            <InfoCard>
              <template #title>Input Context</template>
              <template #info>
                <div class="q-mx-md q-my-sm">
                  <pre>{{ selectedItem?.inputContext }}</pre>
                </div>
              </template>
            </InfoCard>

            <InfoCard>
              <template #title>Output Context</template>
              <template #info>
                <div class="q-mx-md q-my-sm">
                  <pre>{{ selectedItem?.outputContext }}</pre>
                </div>
              </template>
            </InfoCard>
          </div>
        </div>
      </div>

      <div>
        <!-- Empty div for spacing -->
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
import { useRoute } from '#app';
import { ref, onMounted, watchEffect } from 'vue';
import { useRouter } from '#vue-router';
import { useAppStore } from '~/stores/app';

interface SelectedItem {
  label: string;
  uuid: string;
  routineDescription: string;
  progress: number;
  started: string;
  ended: string;
  status: string;
  routineId?: string;
  serverId: string;
  previousRoutineExecution?: string;
  serverName: string;
  previousRoutineName: string;
  contract_id: string;
  layer_index: number;
  inputContext: string;
  outputContext: string;
}

interface SelectedTask {
  label: string;
  name: string;
  description: string;
  uuid: string;
  progress: number;
  started: string;
  ended: string;
  errored: boolean;
  previousTaskExecutionId?: string;
  previous_task_name: string;
  taskId?: string;
  serverId: string;
  serverName: string;
  failed: boolean;
  layer_index: number;
}

const layout = 'dashboard-layout';
const selectedItem = ref<SelectedItem | null>(null);
const route = useRoute();
const selectedTask = ref<SelectedTask | null>(null);
const dialogVisible = ref(false);
const selectedOption = ref('routineMap');
const routineMap = ref<any[]>([]);
const routineMapLoading = ref(false);
const error = ref<string | null>(null);
const router = useRouter();

function onTaskSelected(task: SelectedTask) {
  selectedTask.value = task;
  dialogVisible.value = true;
}

function mapTaskToSelectedTask(task: any): SelectedTask {
  return {
    label: task.label,
    name: task.name,
    description: task.description,
    uuid: task.uuid,
    progress: task.progress,
    started: task.started,
    ended: task.ended,
    errored: task.errored,
    previousTaskExecutionId: task.previousTaskExecutionId,
    previous_task_name: task.previous_task_name,
    taskId: task.taskId,
    serverId: task.serverId,
    serverName: task.serverName,
    failed: task.failed,
    layer_index: task.layer_index,
  };
}

function formatDate(date: string) {
  if (!date) {
    return 'Not finished';
  }
  const datetime = new Date(date);
  return `${datetime.toDateString()} ${datetime.toLocaleTimeString()}`;
}

function getDuration(start: string, end: string | undefined) {
  const startTime = new Date(start);
  let endTime: Date;
  if (!end) {
    endTime = new Date(Date.now());
  } else {
    endTime = new Date(end);
  }
  const duration = +endTime - +startTime;
  return duration / 1000;
}

const navigateToItem = (route: string) => {
  router.push(route);
};

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');

  const itemId = route.params.id as string;
  try {
    // Fetch the specific routine by uuid using the new query param
    const response = await fetch(
      `/api/activity/routines/activeRoutines?uuid=${itemId}`
    );
    if (!response.ok) throw new Error('Failed to fetch routine');
    const data = await response.json();
    selectedItem.value = data || null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
    selectedItem.value = null;
  }

  // Fetch the routine map for this routine
  if (selectedItem.value) {
    try {
      routineMapLoading.value = true;
      const tasks = await fetch(
        `/api/activity/tasks/tasksInRoutines?routineId=${selectedItem.value.uuid}`
      );
      if (!tasks.ok) throw new Error('Failed to fetch routine map');
      const tasksData = await tasks.json();
      routineMap.value = tasksData || [];
    } catch (error) {
      routineMap.value = [];
    } finally {
      routineMapLoading.value = false;
    }
  } else {
    routineMap.value = [];
    routineMapLoading.value = false;
  }
});

const showStopDialog = ref(false);
const showGenerateDialog = ref(false);

function confirmStop() {
  showStopDialog.value = false;
  // Add logic to handle stopping the process
}

function confirmGenerate() {
  showGenerateDialog.value = false;
  // Add logic to handle generating the contract
}
// Flash animation for InfoCard when selectedTask updates
import { nextTick } from 'vue';
const flashActive = ref(false);
const flashCard = ref(null);

watch(selectedTask, async (newVal, oldVal) => {
  if (newVal && oldVal && newVal.uuid !== oldVal.uuid) {
    flashActive.value = false;
    await nextTick();
    flashActive.value = true;
    setTimeout(() => {
      flashActive.value = false;
    }, 700); // Animation duration
  }
});
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
.centered-container {
  width: 100%;
  margin: 0 auto;
}
</style>
<style scoped>
.flash-bg {
  animation: flash-fade 5s;
}
@keyframes flash-fade {
  0% {
    box-shadow: #e6cb47 0px 0px 30px;
    border-radius: 20px;
  }
  60% {
    box-shadow: #e6cb47 0px 0px 15px;
    border-radius: 20px;
  }
  100% {
    background-color: transparent;
    border-radius: 20px;
  }
}
</style>
