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
              <li>IP: {{ serverData?.address || 'Loading...' }}</li>
              <li>PORT: {{ serverData?.port || 'Loading...' }}</li>
              <li>
                Status: {{ serverData?.is_active ? 'Active' : 'Inactive' }}
              </li>
              <li>Description: {{ serverData?.description }}</li>
              <li
                class="text-primary cursor-pointer"
                @click="
                  navigateToItem(
                    `/services/${encodeURIComponent(
                      serverData?.processing_graph || ''
                    )}`
                  )
                "
              >
                Service
              </li>
            </ul>
          </template>
        </InfoCard>
        <q-card class="custom-card">
          <q-card-section class="q-pt-none">
            <div class="row no-wrap items-center">
              <div class="col text-h6 ellipsis">Load From This Service</div>
            </div>
            <ServerStats :selectedServer="aggregatedServer" />
          </q-card-section>
        </q-card>
      </div>
      <div>
        <!-- <ExecutionTimeChart/> -->
        <!-- <FrequencyPieChart/> -->
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from '#app';
import { useRouter } from '#vue-router';

interface ServerData {
  address?: string;
  port?: number;
  is_active?: boolean;
  staticService?: string;
  label?: string;
  processing_graph: string;
  description: string;
}

const route = ref(useRoute());
const router = useRouter();
const serverData = ref<ServerData | null>(null);

const navigateToItem = (route: string): void => {
  router.push(route);
};

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

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('serviceActivity');
  try {
    const data = await $fetch(`/api/activity/servers/${route.value.params.id}`);
    serverData.value = Array.isArray(data) ? data[0] : data;
    console.log('Server data:', serverData.value);
  } catch (error) {
    console.error('Error fetching server data:', error);
  }
});
</script>
