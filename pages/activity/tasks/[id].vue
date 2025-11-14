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
          id-field="uuid"
          label-field="name"
          previous-field="previousTaskExecutionName"
          @item-selected="(task) => navigateToItem(`/activity/tasks/${task.uuid || task.id}`)"
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
                      Progress: {{ (taskExecution.progress * 100).toFixed(0) }}%
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
                  v-if="taskExecution.name"
                  class="q-mx-md q-my-sm cursor-pointer text-primary"
                  @click="navigateToItem(`/system/tasks/${encodeURIComponent(taskExecution.name)}?version=${taskExecution.version || 1}&service=${encodeURIComponent(taskExecution.serverName || taskExecution.serviceName || '')}`)"
                  @contextmenu.prevent="openLinkInNewTab(`/system/tasks/${encodeURIComponent(taskExecution.name)}?version=${taskExecution.version || 1}&service=${encodeURIComponent(taskExecution.serverName || taskExecution.serviceName || '')}`)"
                >
                  Task: {{ taskExecution.name }}
                </div>

                <div
                  class="q-mx-md q-my-sm cursor-pointer text-primary"
                  @click="navigateToItem(`/system/services/${taskExecution.serviceName}`)"
                  @contextmenu.prevent="
                    openLinkInNewTab(`/system/services/${taskExecution.serviceName}`)
                  "
                >
                  Service: {{ taskExecution.serviceName }}
                </div>
                <div
                  class="q-mx-md q-my-sm cursor-pointer text-warning"
                  @click="
                    navigateToItem(
                      `/activity/traces/${taskExecution?.execution_trace_id}`
                    )
                  "
                  @contextmenu.prevent="
                    openLinkInNewTab(
                      `/activity/traces/${taskExecution?.uuid}`
                    )
                  "
                >
                  Trace: {{ taskExecution?.execution_trace_id }}
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
import { ref, onMounted, computed, watch } from 'vue';
import { useAsyncData, useRoute, useRouter, useHead } from '#app';
import { useAppStore } from '@/stores/app';
import { defineAsyncComponent } from 'vue';

// Lazy-load heavier components to improve initial render performance
const FlowMap = defineAsyncComponent(() => import('~/components/FlowMap.vue'));
const ProgressRadialBarChart = defineAsyncComponent(() => import('~/components/ProgressRadialBarChart.vue'));
const InfoCard = defineAsyncComponent(() => import('~/components/InfoCard.vue'));

const route = useRoute();
const router = useRouter();

// reactive id derived from route params — when it changes, useAsyncData will refetch
const taskExecutionId = computed(() => route.params.id as string);

const { data: taskExecution, refresh: refreshTask } = useAsyncData<any>(
  () => `taskExecution-${taskExecutionId.value}`,
  () => $fetch<any>(`/api/activity/tasks/activeTask?id=${taskExecutionId.value}`),
  { server: true }
);

// taskMap depends on the loaded taskExecution; fetch when it becomes available
const taskMap = ref<any[]>([]);
watch(
  taskExecution,
  async (val) => {
    if (!val) {
      taskMap.value = [];
      return;
    }
    try {
      const tasks = await $fetch(
        `/api/activity/tasks/tasksInRoutines?task_execution_id=${val.uuid}`
      );

      // Normalize possible shapes returned by the API into an array before using map
      let taskArray: any[] = [];
      if (!tasks) {
        taskArray = [];
      } else if (Array.isArray(tasks)) {
        taskArray = tasks;
      } else if ((tasks as any).nodes && Array.isArray((tasks as any).nodes)) {
        taskArray = (tasks as any).nodes;
      } else if ((tasks as any).items && Array.isArray((tasks as any).items)) {
        taskArray = (tasks as any).items;
      } else {
        // fallback: try to find an array on the object
        const maybeArray = Object.values(tasks).find((v: any) => Array.isArray(v));
        taskArray = Array.isArray(maybeArray) ? maybeArray : [];
      }

      taskMap.value = taskArray.map((t: any) => ({ ...t, id: t.uuid || t.id }));
    } catch (error) {
      console.error('Error fetching task map:', error);
      taskMap.value = [];
    }
  },
  { immediate: true }
);

useHead({
  title: computed(() =>
    taskExecution.value ? `${taskExecution.value.name} - ${taskExecution.value.uuid?.slice(0, 8)}` : 'Task'
  ),
  meta: [
    {
      name: 'description',
      content: computed(() => taskExecution.value?.description || 'Task execution details'),
    },
  ],
});

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
  router.push(path);
};

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
});

const showStopDialog = ref(false);
const showGenerateDialog = ref(false);

function confirmStop() {
  showStopDialog.value = false;
}

function confirmGenerate() {
  showGenerateDialog.value = false;
}
</script>
