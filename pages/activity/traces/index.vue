<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Traces </template>
      <div class="row q-mx-md">
        <Table
          :columns="columns"
          :rows="traces"
          row-key="uuid"
          @inspect-row="inspectTraces"
          @inspect-row-in-new-tab="inspectInNewTab"
          @loadMoreData="loadMoreTraces"
          :enableInfiniteScroll="true"
          :hasMoreData="hasMoreData"
          :loadingMoreData="loadingMoreData"
        />
        <FrequencyPieChart v-if="traces.length > 0" :values="traces" />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from '#vue-router';
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';

interface Trace {
  type: string;
  label: string;
  description: string;
  id: any;
  executionId: any;
  progress: any;
  uuid: string;
}

const traces = ref<Trace[]>([]);
const hasMoreData = ref(true);
const loadingMoreData = ref(false);
const currentPage = ref(1);
const pageSize = 50;
const router = useRouter();
const { openLinkInNewTab } = useOpenLinkInNewTab();
const columns = [
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    required: true,
    sortable: true,
  },
  {
    name: 'issued',
    label: 'Issued',
    field: 'issued',
    required: true,
    sortable: true,
  },
];
function inspectTraces(trace: Trace) {
  router.push(`traces/${trace.uuid}`);
}
function inspectInNewTab(trace: Trace) {
  openLinkInNewTab(`/activity/traces/${trace.uuid}`);
}
async function loadTraces(isLoadMore = false) {
  try {
    if (isLoadMore) {
      loadingMoreData.value = true;
      currentPage.value++;
    }
    // Note: backend endpoint is still /contracts/contracts
    const response = await fetch(
      `/api/contracts/contracts?page=${currentPage.value}&limit=${pageSize}`
    );
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    if (isLoadMore) {
      traces.value = [...traces.value, ...data.contracts];
    } else {
      traces.value = data.contracts;
    }
    hasMoreData.value = data.contracts.length === pageSize;
  } catch (error) {
    hasMoreData.value = false;
  } finally {
    if (isLoadMore) loadingMoreData.value = false;
  }
}
async function loadMoreTraces() {
  await loadTraces(true);
}
onMounted(async () => {
  await loadTraces();
});
</script>
