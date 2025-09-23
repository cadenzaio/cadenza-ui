<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> Welcome! </template>
      <div class="row justify-around q-ma-lg">
        <InfoCard>
          <template #title> </template>
          <template #info>
            <h5>
              Welcome to the Cadenza! Here you can manage your server task,
              create a new routine, and build new services. In addition to that,
              you can also generate new traces! you also have access to all your
              current server statistics and running processes.
            </h5>
          </template>
        </InfoCard>
        <div>
          <q-card v-if="appStore.isLoggedIn" class="custom-card">
            <q-card-section> </q-card-section>
            <q-card-section class="q-pt-none">
              <div class="row no-wrap items-center">
                <div class="col text-h6 ellipsis">Load on all Servers</div>
              </div>
              <ServerStats :selectedServer="aggregatedServer" />
            </q-card-section>
          </q-card>
          <ExecutionStatisticsPieChart v-if="appStore.isLoggedIn" />
        </div>
      </div>
      <div>
        <HeatMap
          v-if="appStore.isLoggedIn && heatmapData"
          :chartSeries="heatmapData.chartSeries"
          :yearOptions="heatmapData.yearOptions"
          :monthNames="heatmapData.monthNames"
          :editableRanges="heatmapData.editableRanges"
          :rawHeatmapData="heatmapData.rawData"
          @update:editableRanges="(val) => (heatmapData.editableRanges = val)"
        />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAppStore } from '~/stores/app';

const appStore = useAppStore();
const activeProcesses = ref<Server[]>([]);
const heatmapData = ref<any>(null);

const totalCpuUsage = ref(0);
const totalMemoryUsage = ref(0);
const totalGpuUsage = ref(0);
const serverCount = ref(0);

interface Server {
  uuid: string;
  cpu: string;
  gpu: string;
  ram: string;
  is_active: boolean;
  is_non_responsive: boolean;
  is_blocked: boolean;
}

const fetchServerStats = async () => {
  try {
    const response = await $fetch('/api/services/graphs/serverStats');
    activeProcesses.value = (response || []).map((server: any) => ({
      uuid: server.uuid,
      cpu: server.cpu,
      gpu: server.gpu,
      ram: server.ram,
      is_active: server.is_active,
      is_non_responsive: server.is_non_responsive,
      is_blocked: server.is_blocked,
    }));

    // Reset totals before calculating
    totalCpuUsage.value = 0;
    totalMemoryUsage.value = 0;
    totalGpuUsage.value = 0;
    serverCount.value = activeProcesses.value.length;

    // Sum the values across all servers, converting strings to numbers
    activeProcesses.value.forEach((server: Server) => {
      totalCpuUsage.value += parseFloat(server.cpu) || 0;
      totalMemoryUsage.value += parseFloat(server.ram) || 0;
      totalGpuUsage.value += parseFloat(server.gpu) || 0;
    });
  } catch (error) {
    console.error('Error fetching server stats:', error);
  }
};

async function fetchHeatmapData() {
  try {
    const data = await $fetch('/api/heatmap/routineMap');
    heatmapData.value = data;
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
  }
}

// Create an aggregated server object for displaying in ServerStats
// const aggregatedServer = computed(() => ({
//   cpu: totalCpuUsage.value / serverCount.value || 0,
//   gpu: totalGpuUsage.value / serverCount.value || 0,
//   ram: totalMemoryUsage.value / serverCount.value || 0,
// }));

//Temp Random Value generator use above code when server is ready
const aggregatedServer = computed(() => ({
  cpu: (Math.random() * 100) / 100,
  gpu: (Math.random() * 100) / 100,
  ram: Math.random() * 102400,
}));

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('');
  appStore.setLoggedIn(true);
  fetchServerStats();
  fetchHeatmapData();
  appStore.setLoggedIn(true);
});
</script>

<style>
.custom-card {
  border-radius: 20px !important;
}
</style>
