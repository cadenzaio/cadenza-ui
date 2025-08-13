<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Terminology </template>
      <div class="flex">
        <InfoCard>
          <template #title> Color Coding </template>
          <template #info>
            <div>
              <p>
                All links and Menus are color coded to indicate their function:
              </p>
              <ul>
                <li>
                  <span class="text-secondary">Green</span> - Agents/Contracts
                </li>
                <li>
                  <span class="text-primary">Blue</span> - Static Services
                </li>
                <li>
                  <span class="text-warning">Orange</span> - Active Services
                </li>
                <li><span class="text-accent">Purple</span> - Meta</li>
                <li><span class="text-grey-8">Grey</span> - Help</li>
              </ul>
            </div>
          </template>
        </InfoCard>
        <InfoCard>
          <template #title> Icons </template>
          <template #info>
            <div>
              <p>throughout the siteicons are used:</p>
              <ul>
                <li>
                  <q-icon
                    size="sm"
                    name="check"
                    color="green"
                    class="q-ma-xs"
                  />- Complete
                </li>
                <li>
                  <q-icon
                    size="sm"
                    name="play_arrow"
                    color="blue"
                    class="q-ma-xs"
                  />- Running
                </li>
                <li>
                  <q-icon
                    size="sm"
                    name="schedule"
                    color="warning"
                    class="q-ma-xs"
                  />- Scheduled
                </li>
                <li>
                  <q-icon size="sm" name="close" color="red" class="q-ma-xs" />-
                  Failed
                </li>
                <li>
                  <q-btn
                    round
                    size="sm"
                    icon="stop"
                    color="red"
                    class="q-ma-xs"
                  />- Stop
                </li>
                <li>
                  <q-btn
                    round
                    size="sm"
                    icon="refresh"
                    color="secondary"
                    class="q-ma-xs"
                  />- Generate a contract
                </li>
                <li>
                  <q-btn
                    round
                    size="sm"
                    icon="arrow_outward"
                    color="orange"
                    class="q-ma-xs"
                  />- Inspect item
                </li>
                <li>
                  <q-btn
                    round
                    size="sm"
                    icon="wb_sunny"
                    color="warning"
                    class="q-ma-xs"
                  /><q-btn
                    round
                    size="sm"
                    icon="nights_stay"
                    color="grey-8"
                    class="q-ma-xs"
                  />- Light/Dark mode
                </li>
              </ul>
            </div>
          </template>
        </InfoCard>
        <InfoCard>
          <template #title> Terminology </template>
          <template #info>
            <div>
              <p>Here are some key terms used throughout the site:</p>
              <ul>
                <li>
                  <span class="text-secondary">Contract</span> - A
                  implamentation of a service on a server
                </li>
                <li>
                  <span class="text-secondary">Agent</span> - The owner assinged
                  to a contract
                </li>
                <li>
                  <span class="text-primary">Service</span> - A compilation of
                  routines and/or tasks that run on a server
                </li>
                <li>
                  <span class="text-primary">Routine</span> - A set of tasks
                  that run in a service
                </li>
                <li>
                  <span class="text-primary">Task</span> - A single action that
                  is part of a routine
                </li>
                <li>
                  <span class="text-warning">Server</span> - A computer that
                  runs a service
                </li>
                <li>
                  <span class="text-warning">Context</span> - the state of the
                  data being processed before or after
                </li>
                <li><span class="text-accent">Meta</span> - Meta data</li>
              </ul>
            </div>
          </template>
        </InfoCard>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { useAppStore } from '~/stores/app';
import { useRoute } from '#app';

const route = useRoute();

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('help');
});

watch(
  () => route.fullPath,
  (newPath) => {
    if (newPath === '/help/terms') {
      const appStore = useAppStore();
      appStore.setCurrentSection('help');
    }
  }
);
</script>
