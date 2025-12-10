<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        {{ serverData?.processing_graph || route.params.id }}
      </template>
      <div class="row justify-around q-ma-lg">
        <InfoCard>
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
                      serverData?.service_name || ''
                    )}`
                  )
                "
                @contextmenu.prevent="
                  openLinkInNewTab(
                    `/system/services/${encodeURIComponent(
                      serverData?.service_name || ''
                    )}`
                  )
                "
              >
                Service
              </li>
            </ul>
          </template>
        </InfoCard>
        <ServiceTimeChart :series="timeChartSeries" />
      </div>
      <div class="q-pa-lg">
        <HeatMap
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
