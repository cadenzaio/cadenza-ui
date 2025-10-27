<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ taskExecution?.name }} - {{ taskExecution?.uuid?.slice(0, 8) }}
        <q-btn color="warning" @click="showGenerateDialog = true"
          >Generate Trace
          <q-tooltip anchor="top middle" self="bottom middle">
            Generate a Trace from this point
          </q-tooltip>
        </q-btn>
      </template>
      <div>
        <FlowMap
          :items="taskMap"
          id-field="name"
          label-field="name"
          previous-field="previousTaskExecutionId"
          @item-selected="(task) => navigateToItem(`/activity/tasks/${task.name || task.uuid}`)"
        ></FlowMap>
      </div>

      <div class="q-mx-md">
        <InfoCard v-if="taskExecution" class="full-width">
          <template #title>
            {{ taskExecution.name }}
          </template>
          <template #info>
            <div class="row" style="flex-wrap: wrap;">
              <!-- First Column -->
              <div class="col" style="min-width: 300px;">
                <div class="q-mx-md q-my-sm">
                  Description: {{ taskExecution.description }}
                </div>
                <div class="q-mx-md q-my-sm">
                  Execution ID: {{ taskExecution.uuid }}
                </div>
                <div class="q-mx-md q-my-sm">
                  Routine Name: {{ taskExecution.routineName }}
                </div>
                <div class="q-mx-md q-my-sm">
                  Is Unique: {{ taskExecution.isUnique }}
                </div>
              </div>

              <!-- Second Column -->
              <div class="col" style="min-width: 300px;">
                <div class="row items-center">
                  <div class="col">
                    <div class="q-mx-md q-my-sm">
                      Progress: {{ taskExecution.progress }}%
                    </div>
                    <div class="q-mx-md q-my-sm">
                      Success: {{ !taskExecution.failed && !taskExecution.errored }}
                    </div>
                    <div class="q-mx-md q-my-sm">
                      Started: {{ formatDate(taskExecution.started) }}
                    </div>
                    <div class="q-mx-md q-my-sm">
                      Ended: {{ formatDate(taskExecution.ended) }}
                    </div>
                    <div class="q-mx-md q-my-sm">
                      Duration:
                      {{
                        getDuration(taskExecution.started, taskExecution.ended)
                      }}
                      sec
                    </div>
                  </div>
                  <div class="col-auto">
                    <ProgressRadialBarChart
                      v-if="taskExecution"
                      :name="taskExecution?.name"
                      :value="taskExecution?.progress"
                    />
                  </div>
                </div>
              </div>

              <!-- Third Column -->
              <div class="col" style="min-width: 300px;">
                <div
                  v-if="taskExecution.previousTaskExecutionId !== null"
                  class="q-mx-md q-my-sm cursor-pointer text-warning"
                >
                  <div
                    v-for="(id, index) in taskExecution.previousTaskExecutionId"
                    :key="index"
                    @click="navigateToItem(`/activity/tasks/${id}`)"
                    @contextmenu.prevent="
                      openLinkInNewTab(`/activity/tasks/${id}`)
                    "
                  >
                    Previous {{ taskExecution.previousTaskNames[index] }}
                  </div>
                </div>
                <div
                  v-if="taskExecution.nextTaskExecutionId !== null"
                  class="q-mx-md q-my-sm cursor-pointer text-warning"
                >
                  <div
                    v-for="(id, index) in taskExecution.nextTaskExecutionId"
                    :key="index"
                    @click="navigateToItem(`/activity/tasks/${taskExecution.nextTaskExecutionId}`)"
                    @contextmenu.prevent="
                      openLinkInNewTab(`/activity/tasks/${taskExecution.nextTaskExecutionId}`)
                    "
                  >
                    Next {{ taskExecution.nextTaskNames[index] }}
                  </div>
                </div>
                <div
                  class="q-mx-md q-my-sm cursor-pointer text-warning"
                  @click="
                    navigateToItem(
                      `/activity/routines/${taskExecution.routineExecutionId}`
                    )
                  "
                  @contextmenu.prevent="
                    openLinkInNewTab(
                      `/activity/routines/${taskExecution.routineExecutionId}`
                    )
                  "
                >
                  Routine Execution ID: {{ taskExecution.routineName }}
                </div>

                <div
                  v-if="taskExecution.taskId"
                  class="q-mx-md q-my-sm cursor-pointer text-primary"
                  @click="
                    navigateToItem(`/services/tasks/${taskExecution.taskId}`)
                  "
                  @contextmenu.prevent="
                    openLinkInNewTab(`/services/tasks/${taskExecution.taskId}`)
                  "
                >
                  Task: {{ taskExecution.name }}
                </div>

                <div
                  class="q-mx-md q-my-sm cursor-pointer text-primary"
                  @click="navigateToItem(`/services/${taskExecution.serverName}`)"
                  @contextmenu.prevent="
                    openLinkInNewTab(`/services/${taskExecution.serverName}`)
                  "
                >
                  Server: {{ taskExecution.serverName }}
                </div>
                <div
                  class="q-mx-md q-my-sm"
                  @click="
                    navigateToItem(
                      `/activity/traces/${taskExecution?.contract_id}`
                    )
                  "
                  @contextmenu.prevent="
                    openLinkInNewTab(
                      `/activity/traces/${taskExecution?.contract_id}`
                    )
                  "
                >
                  <span class="text-warning cursor-pointer">Trace</span>
                </div>
              </div>
            </div>
          </template>
        </InfoCard>

        <div class="row" style="flex-wrap: wrap;">
          <InfoCard class="col" style="min-width: 300px;">
            <template #title>Input Context</template>
            <template #info>
              <div class="q-mx-md q-my-sm">
                <pre>{{ taskExecution?.inputContext }}</pre>
              </div>
            </template>
          </InfoCard>

          <InfoCard class="col" style="min-width: 300px;">
            <template #title>Tasks Function</template>
            <template #info>
              <div class="q-mx-md q-my-sm">
                <pre>{{ taskExecution?.functionString }}</pre>
              </div>
            </template>
          </InfoCard>

          <InfoCard class="col" style="min-width: 300px;">
            <template #title>Output Context</template>
            <template #info>
              <div class="q-mx-md q-my-sm">
                <pre>{{ taskExecution?.outputContext }}</pre>
              </div>
            </template>
          </InfoCard>
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
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();
import { useFetch, useRoute } from '#app';
import { ref, onMounted } from 'vue';
import { useRouter } from '#vue-router';
import { useAppStore } from '@/stores/app';
import { computedAsync } from '@vueuse/core';

const layout = 'dashboard-layout';
const route = useRoute();
const router = useRouter();
const taskExecutionId = ref<string>('');
const taskExecution = ref<any>(null);

async function fetchTaskExecution() {
  if (!taskExecutionId.value) return;

  try {
    const result = await $fetch(
      `/api/activity/tasks/activeTask?id=${taskExecutionId.value}`
    );
    console.log('API fetch result (activeTask):', result);
    if (result) {
      taskExecution.value = result;
    }
  } catch (error) {
    console.error('Error fetching task execution:', error);
  }
}

const Item = computed(() => taskExecution.value);

interface Item {
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

const taskMap = computedAsync(async () => {
  if (Item.value) {
    try {
      const tasks = await $fetch(
        `/api/activity/tasks/tasksInRoutines?routineId=${taskExecution.value.routineExecutionId}&selectedTaskId=${taskExecution.value.uuid}&selectionType=execution`
      );
      console.log('API fetch result (tasksInRoutines):', tasks);
      return (tasks || []).map((task: any) => ({
        ...task,
        id: task.uuid,
      }));
    } catch (error) {
      console.error('Error fetching task map:', error);
      return [];
    }
  }
  return [];
}, []);

function formatDate(date?: string) {
  if (!date) return 'Not finished';
  const datetime = new Date(date);
  return `${datetime.toDateString()} ${datetime.toLocaleTimeString()}`;
}

function getDuration(start?: string, end?: string) {
  if (!start) return 'N/A';
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  return ((endTime - startTime) / 1000).toFixed(2);
}

const navigateToItem = (path: string) => {
  console.log('Navigating to:', path);
  router.push(path);
};

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');

  taskExecutionId.value = route.params.id as string;
  fetchTaskExecution();
});

const showStopDialog = ref(false);
const showGenerateDialog = ref(false);

function confirmStop() {
  showStopDialog.value = false;
  // Add logic to handle stopping the process
}

function confirmGenerate() {
  showGenerateDialog.value = false;
  // Add logic to handle generating the trace
}
</script>
