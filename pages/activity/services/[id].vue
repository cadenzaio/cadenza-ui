<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ serverData?.processing_graph || route.params.id }}
      </template>

      <!-- Loading Overlay -->
      <q-inner-loading :showing="pageLoading" class="loading-overlay">
        <q-spinner-gears size="120px" color="#777777" />
        Loading...
      </q-inner-loading>

      <div :class="{ 'content-dimmed': pageLoading }" class="page-content">
        <div class="row q-ma-md" style="gap: 24px;">
          <!-- Left Column: Timeline and Heatmap -->
          <div class="col" style="flex: 1 1 65%;">
            <div class="column" style="gap: 24px;">
              <ServiceTimeChart :series="timeChartSeries" style="width: 100%;"/>
              <HeatMap
                style="width: 100%;"
                :loading="heatmapLoading"
                :hasData="heatmapHasData"
                :chartSeries="heatmapChartSeries"
                :yearOptions="heatmapYearOptions"
                :monthNames="heatmapMonthNames"
                :editableRanges="heatmapEditableRanges"
                :rawHeatmapData="heatmapRawData"
                @update:editableRanges="onUpdateEditableRanges"
              />
            </div>
          </div>
          <!-- Right Column: Info Cards -->
          <div class="col" style="flex: 0 0 30%;">
            <div class="column" style="gap: 24px;">
              <InfoCard style="width: 100%; min-height: 250px;">
                <template #title>
                  <h4>Service Status</h4>
                </template>
                <template #info>
                  <ul>
                    <li>Server: {{ serverData?.address || 'N/A' }}</li>
                    <li>PORT: {{ serverData?.port || 'N/A' }}</li>
                    <li>
                      Status: {{ serverData?.is_active ? 'Active' : 'Inactive' }}
                    </li>
                    <li>Description: {{ serverData?.description || 'None' }}</li>
                    <li
                      class="text-primary cursor-pointer"
                      @click="
                        navigateToItem(
                          `/system/services/${encodeURIComponent(
                            String(serverData?.service_name || '')
                          )}`
                        )
                      "
                      @contextmenu.prevent="
                        openLinkInNewTab(
                          `/system/services/${encodeURIComponent(
                            String(serverData?.service_name || '')
                          )}`
                        )
                      "
                    >
                      Service
                    </li>
                  </ul>
                </template>
              </InfoCard>
              <ServiceLog :serviceInstanceId="selectedInstance" />
            </div>
          </div>
        </div>
      </div>
      <!-- <q-card class="custom-card">
          <q-card-section class="q-pt-none">
            <div class="row no-wrap items-center">
              <div class="col text-h6 ellipsis">Load From This Service</div>
            </div>
            <ServerStats :selectedServer="aggregatedServer" />
          </q-card-section>
        </q-card> -->
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useOpenLinkInNewTab } from '~/composables/useOpenLinkInNewTab';
const { openLinkInNewTab } = useOpenLinkInNewTab();
import { ref, onMounted, watch, computed, type Ref } from 'vue';
import { useRoute } from '#app';
import { useRouter } from '#vue-router';
import HeatMap from '~/components/HeatMap.vue';
import ServiceTimeChart from '~/components/ServiceTimeChart.vue';
import ServiceLog from '~/components/ServiceLog.vue';

interface ServerData {
  address?: string;
  port?: number;
  is_active?: boolean;
  staticService?: string;
  label?: string;
  processing_graph: string;
  description: string;
  service_name?: string;
}

const route = ref(useRoute());
const router = useRouter();
const serverRows = ref<any[]>([]);
const serverData = ref<ServerData | null>(null);
const selectedInstance = ref<string | null>(null);
const timeChartSeries = ref<any[]>([]);
const pageLoading = ref(true);


async function fetchTaskSeries(serviceInstanceId: string | null) {
  if (!serviceInstanceId) return [];
  try {
    const qs = `?serviceInstanceId=${encodeURIComponent(serviceInstanceId)}`;
    const res: any = await $fetch(`/api/activity/servers/serverStatistics${qs}`);
    if (res && Array.isArray(res.series)) {
      return res.series;
    }
    return [];
  } catch (e) {
    console.error('Failed to fetch task series:', e);
    return [];
  }
}

const heatmapLoading = ref(false);
const heatmapHasData = ref(false);
const heatmapChartSeries = ref([]);
const heatmapMonthNames = ref([]);
const heatmapYearOptions = ref([]);
const heatmapEditableRanges: Ref<any[]> = ref<any[]>([]);
const heatmapRawData = ref<any[]>([]);

const navigateToItem = (route: string): void => {
  router.push(route);
};

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
  pageLoading.value = true;
    try {
      const data = await $fetch(`/api/activity/servers/${route.value.params.id}`);
      serverRows.value = Array.isArray(data) ? data : [data];
      serverData.value = serverRows.value.length ? serverRows.value[0] : null;
      selectedInstance.value = String(route.value.params.id);
      fetchHeatmap(selectedInstance.value);
      const taskSeries = await fetchTaskSeries(selectedInstance.value);
      timeChartSeries.value = Array.isArray(taskSeries) ? taskSeries : [];
  } catch (error) {
    console.error('Error fetching server data:', error);
  } finally {
    pageLoading.value = false;
  }
});

async function fetchHeatmap(serviceInstanceId: string | null) {
  heatmapLoading.value = true;
  try {
    const qs = serviceInstanceId ? `?serviceInstanceId=${encodeURIComponent(serviceInstanceId)}` : '';
    const res: any = await $fetch(`/api/heatmap/serviceInstance${qs}`);
    heatmapChartSeries.value = res.chartSeries || res.series || [];
    heatmapMonthNames.value = res.monthNames || [];
    heatmapYearOptions.value = res.yearOptions || [];
    heatmapEditableRanges.value = res.editableRanges || [];
    heatmapRawData.value = res.rawData || [];
    heatmapHasData.value = Array.isArray(heatmapRawData.value) && heatmapRawData.value.length > 0;
  } catch (e) {
    console.error('Failed to fetch heatmap:', e);
    heatmapHasData.value = false;
  } finally {
    heatmapLoading.value = false;
  }
}

function onUpdateEditableRanges(v: any) {
  heatmapEditableRanges.value = v;
}
</script>

<style scoped>
.loading-overlay {
  z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
}

.content-dimmed {
  opacity: 0.5;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.page-content {
  transition: opacity 0.3s ease;
}

.service-log-table {
  max-height: 300px;
}

.service-log-table :deep(tbody tr) {
  cursor: pointer;
}

.service-log-table :deep(tbody tr:hover) {
  background-color: rgba(0, 0, 0, 0.05);
}

.log-data-pre {
  background-color: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 300px;
  font-size: 12px;
  margin: 0;
}
</style>
