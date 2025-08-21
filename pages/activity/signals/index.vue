<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Signal executions </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="signals"
          row-key="uuid"
          @inspect-row="inspectSignal"
          @inspect-row-in-new-tab="inspectInNewTab"
          :enableInfiniteScroll="false"
          :hasMoreData="false"
          :loadingMoreData="false"
        />
        <FrequencyPieChart v-if="signals.length > 0" :values="signals" />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from '#vue-router';
import { useAppStore } from '~/stores/app';
import FrequencyPieChart from '~/components/FrequencyPieChart.vue';

interface Signal {
  name: string;
  status: string;
  value: string;
  started: string;
  ended: string;
  duration: number;
  uuid: string;
}

const columns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    required: true,
    sortable: true,
  },
  {
    name: 'status',
    label: 'Status',
    field: 'status',
    required: true,
    sortable: true,
  },
  {
    name: 'value',
    label: 'Value',
    field: 'value',
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

const signals = ref<Signal[]>([
  {
    name: 'Signal 1',
    status: 'check',
    value: 'OK',
    started: '2025-08-21T10:00:00Z',
    ended: '2025-08-21T10:00:01Z',
    duration: 1,
    uuid: 'sig-1',
  },
  {
    name: 'Signal 2',
    status: 'close',
    value: 'Threshold Exceeded',
    started: '2025-08-21T09:55:00Z',
    ended: '2025-08-21T09:55:05Z',
    duration: 5,
    uuid: 'sig-2',
  },
  {
    name: 'Signal 3',
    status: 'play_arrow',
    value: 'In Progress',
    started: '2025-08-21T09:50:00Z',
    ended: '',
    duration: 0,
    uuid: 'sig-3',
  },
  {
    name: 'Signal 4',
    status: 'schedule',
    value: 'Scheduled',
    started: '2025-08-21T11:00:00Z',
    ended: '',
    duration: 0,
    uuid: 'sig-4',
  },
]);

const router = useRouter();

function inspectSignal(signal: Signal) {
  navigateToItem(`/activity/signals/${signal.uuid}`);
}
function inspectInNewTab(signal: Signal) {
  const url = `/activity/signals/${signal.uuid}`;
  window.open(url, '_blank');
}

const navigateToItem = (route: string) => {
  router.push(route);
};

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
});
</script>
