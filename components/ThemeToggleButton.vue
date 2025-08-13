<template>
  <q-btn
    flat
    round
    :icon="iconName"
    @click="toggleDarkMode"
  />
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useAppStore } from '../stores/app';

export default defineComponent({
  name: 'ThemeToggleButton',
  setup() {
    const $q = useQuasar();
    const appStore = useAppStore();

    // Initialize Quasar dark mode based on the store value
    $q.dark.set(appStore.isDarkMode);

    const toggleDarkMode = () => {
      appStore.toggleDarkMode();
      $q.dark.set(appStore.isDarkMode);
    };

    const iconName = computed(() => (appStore.isDarkMode ? 'wb_sunny' : 'nights_stay'));

    return {
      toggleDarkMode,
      iconName
    };
  }
});
</script>
