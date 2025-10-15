<template>
  <q-card
    class="custom-card col flex-center q-ma-md"
    elevated
    style="max-width: 50dvw; max-height: 70dvh; overflow-y: auto"
  >
    <div v-if="loading" class="col q-pa-md flex column items-center justify-center" style="min-height: 200px;">
      <q-spinner-dots size="40px" color="primary" class="q-mb-md" />
      <div class="text-subtitle1">Loading server stats...</div>
    </div>
    
    <div v-else-if="!hasData" class="col q-pa-md flex column items-center justify-center" style="min-height: 200px;">
      <q-icon name="dns" size="48px" color="grey-5" class="q-mb-md" />
      <div class="text-subtitle1 text-grey-6">No server data available</div>
    </div>
    
    <div v-else class="col q-pa-md flex flex-start">
      <span class="text-caption"> CPU</span>
      <q-linear-progress
        size="25px"
        :value="selectedServer.cpu"
        color="primary"
      >
        <div class="absolute-full flex flex-center">
          <q-badge
            color="white"
            text-color="primary"
            :label="`${Math.round(selectedServer.cpu * 100)}%`"
          />
        </div>
      </q-linear-progress>
      <span class="text-caption">GPU</span>
      <q-linear-progress
        size="25px"
        :value="selectedServer.gpu"
        color="secondary"
      >
        <div class="absolute-full flex flex-center">
          <q-badge
            color="white"
            text-color="secondary"
            :label="`${Math.round(selectedServer.gpu * 100)}%`"
          />
        </div>
      </q-linear-progress>
      <span class="text-caption">RAM</span>
      <q-linear-progress
        size="25px"
        :value="selectedServer.ram / (128 * 1024)"
        color="warning"
      >
        <div class="absolute-full flex flex-center">
          <q-badge
            color="white"
            text-color="warning"
            :label="`${(selectedServer.ram / 1024).toFixed(2)}GB`"
          />
        </div>
      </q-linear-progress>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';

interface ServerStats {
  cpu: number; // 0-1
  gpu: number; // 0-1
  ram: number; // in MB
}

const props = defineProps<{ 
  selectedServer: ServerStats;
  loading?: boolean;
  hasData?: boolean;
}>();
</script>

<style>
.custom-card {
  border-radius: 20px !important;
}
</style>
