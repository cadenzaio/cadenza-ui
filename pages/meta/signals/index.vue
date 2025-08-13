<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div>
        <h1>Signals</h1>
        <p>
          Manage your signals
          <NuxtLink :to="'/meta/signals/1'">here</NuxtLink>.
        </p>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useRoute } from '#app';
import { useAppStore } from '~/stores/app';

const route = useRoute();

onMounted(async () => {
  const appStore = useAppStore();
  appStore.setCurrentSection('meta');
});
</script>
