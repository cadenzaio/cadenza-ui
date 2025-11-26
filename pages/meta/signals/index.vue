<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Meta Signal Executions </template>
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
  uuid: string;
  service: string;
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
    name: 'service',
    label: 'Service',
    field: 'service',
    required: true,
    sortable: true,
  },
];

const signals = ref<Signal[]>([]);
const loading = ref(false);
const router = useRouter();

function inspectSignal(signal: Signal) {
  navigateToItem(`/meta/signals/${signal.uuid}`);
}
function inspectInNewTab(signal: Signal) {
  const url = `/meta/signals/${signal.uuid}`;
  window.open(url, '_blank');
}

const navigateToItem = (route: string) => {
  router.push(route);
};

async function fetchSignals() {
  loading.value = true;
  try {
    const response = await fetch('/api/meta/signals/metaSignals');
    const result = await response.json();
    signals.value = result.map((item: any) => ({
      name: item.name,
      uuid: item.uuid,
      service: item.service,
    }));
  } catch (error) {
    console.error('Error fetching signals:', error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');
  fetchSignals();
});
</script>
