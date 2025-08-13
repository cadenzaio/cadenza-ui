<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div>
        <h1>Signal Details</h1>
        <p>Manage your signal details here.</p>
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
