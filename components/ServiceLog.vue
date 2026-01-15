<template>
  <q-card class="custom-card q-mb-md overflow-auto q-ma-sm">
    <div class="row items-center justify-between full-width">
      <h4 class="q-pa-sm q-ma-none">Service Log</h4>
      <div class="row items-center q-gutter-sm q-pr-sm">
        <q-checkbox v-model="logLevelFilters.critical" label="Critical" dense size="sm" color="negative" />
        <q-checkbox v-model="logLevelFilters.error" label="Error" dense size="sm" color="red" />
        <q-checkbox v-model="logLevelFilters.warning" label="Warning" dense size="sm" color="orange" />
        <q-checkbox v-model="logLevelFilters.info" label="Info" dense size="sm" color="green" />
      </div>
    </div>
    <q-table
      ref="logTableRef"
      :rows="filteredLogRows"
      :columns="logColumns"
      row-key="uuid"
      :loading="logLoading"
      flat
      dense
      separator="none"
      virtual-scroll
      :virtual-scroll-item-size="28"
      :virtual-scroll-sticky-size-start="28"
      :rows-per-page-options="[0]"
      class="service-log-table"
      :row-class="getLogRowClass"
      @row-click="onLogRowClick"
      @virtual-scroll="onLogScroll"
    >
      <template v-slot:body-cell-level="props">
        <q-td :props="props">
          <q-badge :color="props.row.level === 'critical' ? 'negative' : props.row.level === 'error' ? 'red' : props.row.level === 'warning' ? 'orange' : 'green'">
            {{ props.row.level }}
          </q-badge>
        </q-td>
      </template>
      <template v-slot:no-data>
        <div class="full-width row flex-center q-gutter-sm text-grey">
          <span>No logs available</span>
        </div>
      </template>
    </q-table>
    <q-dialog v-model="logDialogOpen" persistent>
      <q-card style="min-width: 500px; max-width: 800px;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Log Details</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section v-if="selectedLog">
          <q-list dense separator>
            <q-item>
              <q-item-section>
                <q-item-label caption>Timestamp</q-item-label>
                <q-item-label>{{ selectedLog.created }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Level</q-item-label>
                <q-item-label>
                  <q-badge :color="selectedLog.level === 'critical' ? 'red' : selectedLog.level === 'error' ? 'negative' : selectedLog.level === 'warning' ? 'orange' : 'green'">
                    {{ selectedLog.level }}
                  </q-badge>
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Message</q-item-label>
                <q-item-label>{{ selectedLog.message }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Service Name</q-item-label>
                <q-item-label>{{ selectedLog.serviceName || 'N/A' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Service Instance ID</q-item-label>
                <q-item-label class="text-caption">{{ selectedLog.serviceInstanceId || 'N/A' }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="selectedLog.subjectServiceName">
              <q-item-section>
                <q-item-label caption>Subject Service Name</q-item-label>
                <q-item-label>{{ selectedLog.subjectServiceName }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="selectedLog.subjectServiceInstanceId">
              <q-item-section>
                <q-item-label caption>Subject Service Instance ID</q-item-label>
                <q-item-label class="text-caption">{{ selectedLog.subjectServiceInstanceId }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>UUID</q-item-label>
                <q-item-label class="text-caption">{{ selectedLog.uuid }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item v-if="selectedLog.data && Object.keys(selectedLog.data).length > 0">
              <q-item-section>
                <q-item-label caption>Data</q-item-label>
                <q-item-label>
                  <pre class="log-data-pre">{{ JSON.stringify(selectedLog.data, null, 2) }}</pre>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';

const props = defineProps<{
  serviceInstanceId: string | null;
}>();

const $q = useQuasar();
const logRows = ref<any[]>([]);
const logLoading = ref(false);
const logDialogOpen = ref(false);
const selectedLog = ref<any>(null);
const logTableRef = ref<any>(null);
const logPage = ref(1);
const logLimit = 100;
const logHasMore = ref(true);
const logLoadingMore = ref(false);
const logLevelFilters = ref({
  critical: true,
  error: true,
  warning: true,
  info: true
});
const logColumns = [
  { name: 'created', label: 'Timestamp', field: 'created', align: 'left' as const, sortable: true },
  { name: 'level', label: 'Level', field: 'level', align: 'center' as const },
  { name: 'message', label: 'Message', field: 'message', align: 'left' as const }
];
const filteredLogRows = computed(() => {
  return logRows.value.filter(row => logLevelFilters.value[row.level as keyof typeof logLevelFilters.value] !== false);
});

function getLogRowClass(row: any) {
  return row.level === 'critical' ? 'bg-red-2' : '';
}

function onLogRowClick(evt: Event, row: any) {
  selectedLog.value = row;
  logDialogOpen.value = true;
}

function onLogScroll(details: { to: number; ref: any }) {
  const lastIndex = filteredLogRows.value.length - 1;
  if (logLoadingMore.value || !logHasMore.value) return;
  if (details.to >= lastIndex - 5) {
    loadMoreLogs();
  }
}

async function loadMoreLogs() {
  if (!props.serviceInstanceId || logLoadingMore.value || !logHasMore.value) return;
  logLoadingMore.value = true;
  try {
    const nextPage = logPage.value + 1;
    const qs = `?serviceInstanceId=${encodeURIComponent(props.serviceInstanceId)}&page=${nextPage}&limit=${logLimit}`;
    const res: any = await $fetch(`/api/activity/servers/instanceLog${qs}`);
    const newLogs = res?.logs || [];
    if (newLogs.length < logLimit) {
      logHasMore.value = false;
    }
    if (newLogs.length > 0) {
      logRows.value = [...logRows.value, ...newLogs];
      logPage.value = nextPage;
    }
  } catch (e) {
    console.error('Failed to load more logs:', e);
  } finally {
    logLoadingMore.value = false;
  }
}

async function fetchLogs(serviceInstanceId: string | null) {
  if (!serviceInstanceId) return;
  logLoading.value = true;
  logPage.value = 1;
  logHasMore.value = true;
  logRows.value = [];
  try {
    // Determine which levels are selected
    const activeLevels = Object.entries(logLevelFilters.value)
      .filter(([level, checked]) => checked)
      .map(([level]) => level);
    let qs = `?serviceInstanceId=${encodeURIComponent(serviceInstanceId)}&page=1&limit=${logLimit}`;
    // If only one level is selected, use server-side filtering
    if (activeLevels.length === 1) {
      qs += `&level=${encodeURIComponent(activeLevels[0])}`;
    }
    const res: any = await $fetch(`/api/activity/servers/instanceLog${qs}`);
    const logs = res?.logs || [];
    logRows.value = logs;
    if (logs.length < logLimit) {
      logHasMore.value = false;
    }
  } catch (e) {
    console.error('Failed to fetch logs:', e);
    logRows.value = [];
  } finally {
    logLoading.value = false;
  }
}

// Refetch logs when serviceInstanceId or logLevelFilters change
watch([
  () => props.serviceInstanceId,
  () => ({ ...logLevelFilters.value })
], ([id]) => {
  fetchLogs(id);
}, { immediate: true });
</script>

<style scoped>
.service-log-table {
  min-height: 200px;
  max-height: 400px;
}
.log-data-pre {
  font-size: 12px;
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
