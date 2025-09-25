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
                <li><span class="text-secondary">Green</span> - Home</li>
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
                  <q-icon
                    size="sm"
                    name="fiber_manual_record"
                    color="green"
                    class="q-ma-xs"
                  />- Unique
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
                    color="warning"
                    class="q-ma-xs"
                  />- Generate a trace
                </li>
                <li>
                  <q-btn
                    round
                    size="sm"
                    icon="arrow_outward"
                    class="q-ma-xs gradient-fade-btn"
                    :style="inspectBtnStyle"
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
                  <span class="text-secondary">Home</span> - The start page
                </li>
                <li>
                  <span class="text-primary">Service</span> - A compilation of
                  routines and/or tasks that run on a server
                </li>
                <li>
                  <span class="text-warning">Server</span> - A computer that
                  runs a service
                </li>
                <li>
                  <span class="text-warning">Context</span> - the state of the
                  data being processed before or after
                </li>
                <li>
                  <span class="text-warning">Traces</span> - A implementation of
                  a service on a server
                </li>
                <li><span class="text-accent">Meta</span> - Meta data</li>
                <li>
                  <span :style="dynamicColor">Routine</span> - A set of tasks
                  that run in a service
                </li>
                <li>
                  <span :style="dynamicColor">Task</span> - A single action that
                  is part of a routine
                </li>
                <li>
                  <span :style="dynamicColor">Signal</span> - A trigger that
                  starts another action
                </li>
              </ul>
            </div>
          </template>
        </InfoCard>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAppStore } from '~/stores/app';
import { useRoute } from '#app';

const appStore = useAppStore();
const route = useRoute();

// Gradient color cycling for Inspect item button
const inspectColors = [
  '#1976d2', // blue
  '#f2c037', // orange
  '#8e24aa', // purple
];
const currentIdx = ref(0);
const nextIdx = ref(1);

let progress = ref(0); // 0 to 1
let isPaused = ref(true);
let pauseTimeout = null;
let animationFrame = null;

function lerpColor(a, b, t) {
  // a, b: hex color strings; t: 0-1
  const ah = a.replace('#', '');
  const bh = b.replace('#', '');
  const ar = parseInt(ah.substring(0, 2), 16);
  const ag = parseInt(ah.substring(2, 4), 16);
  const ab = parseInt(ah.substring(4, 6), 16);
  const br = parseInt(bh.substring(0, 2), 16);
  const bg = parseInt(bh.substring(2, 4), 16);
  const bb = parseInt(bh.substring(4, 6), 16);
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

const inspectBtnStyle = computed(() => {
  const colorA = inspectColors[currentIdx.value];
  const colorB = inspectColors[nextIdx.value];
  const bg = lerpColor(colorA, colorB, progress.value);
  return {
    background: bg,
    color: '#fff',
    transition: 'background 0.5s linear',
  };
});

const dynamicColor = computed(() => {
  const colorA = inspectColors[currentIdx.value];
  const colorB = inspectColors[nextIdx.value];
  const colors = lerpColor(colorA, colorB, progress.value);
  return {
    color: colors,
  };
});

function startPause() {
  isPaused.value = true;
  pauseTimeout = setTimeout(() => {
    isPaused.value = false;
    animationFrame = requestAnimationFrame(animateGradient);
  }, 2000); // 2s pause
}

function animateGradient() {
  if (isPaused.value) return;
  progress.value += 0.02; // adjust for smoothness/speed
  if (progress.value >= 1) {
    progress.value = 0;
    currentIdx.value = nextIdx.value;
    nextIdx.value = (nextIdx.value + 1) % inspectColors.length;
    startPause();
    return;
  }
  animationFrame = requestAnimationFrame(animateGradient);
}

onMounted(() => {
  appStore.setCurrentSection('help');
  startPause();
});

onBeforeUnmount(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (pauseTimeout) clearTimeout(pauseTimeout);
});

watch(
  () => route.fullPath,
  (newPath) => {
    if (newPath === '/help/terms') {
      appStore.setCurrentSection('help');
    }
  }
);
</script>
