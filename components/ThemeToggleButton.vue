<template>
  <q-btn flat round :icon="iconName" @click="toggleDarkMode" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { useAppStore } from '../stores/app';

const $q = useQuasar();
const appStore = useAppStore();

// Initialize Quasar dark mode based on the store value
$q.dark.set(appStore.isDarkMode);

function toggleDarkMode(): void {
  appStore.toggleDarkMode();
  $q.dark.set(appStore.isDarkMode);
}

const iconName = computed((): string =>
  appStore.isDarkMode ? 'wb_sunny' : 'nights_stay'
);
</script>
