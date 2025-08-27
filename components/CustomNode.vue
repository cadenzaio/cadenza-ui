<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

// Define the interface for the node data

interface NodeData {
  label: string;
  uuid: string;
  description: string;
  is_unique: boolean;
  concurrency: number;
  isSelected: boolean;
  errored: boolean;
  failed: boolean;
  isRunning?: boolean;
  isScheduled?: boolean;
  signal?: boolean;
  meta?: boolean;
}

const props = defineProps<{ data: NodeData }>();
console.log('CustomNode.vue received prop:', props.data);

import { computed } from 'vue';
import { useAppStore } from '~/stores/app';
import { colors, useQuasar } from 'quasar';

const appStore = useAppStore();
const currentSection = appStore.currentSection;
const $q = useQuasar();

const nodeBg = computed(() => {
  switch (currentSection) {
    case 'services':
      return colors.changeAlpha(colors.getPaletteColor('primary'), 0.6);
    case 'serviceActivity':
      return colors.changeAlpha(colors.getPaletteColor('warning'), 0.6);
    case 'contracts':
      return colors.changeAlpha(colors.getPaletteColor('secondary'), 0.6);
    case 'meta':
      return colors.changeAlpha(colors.getPaletteColor('accent'), 0.6);
    case 'help':
      return colors.changeAlpha(colors.getPaletteColor('grey-8'), 0.6);
    default:
      return colors.changeAlpha(colors.getPaletteColor('secondary'), 0.6);
  }
});

const nodeSelectedBg = computed(() => {
  switch (currentSection) {
    case 'services':
      return colors.getPaletteColor('primary');
    case 'serviceActivity':
      return colors.getPaletteColor('warning');
    case 'contracts':
      return colors.getPaletteColor('secondary');
    case 'meta':
      return colors.getPaletteColor('accent');
    case 'help':
      return colors.getPaletteColor('grey-8');
    default:
      return colors.getPaletteColor('secondary');
  }
});

const nodeSelectedBorder = computed(() =>
  $q.dark.isActive ? '2px solid #fff' : '2px solid #222'
);
</script>

<template>
  <div
    :class="[
      'custom-node',
      data.isSelected ? 'selected-node' : '',
      data.errored ? 'errored-node' : '',
      data.failed ? 'failed-node' : '',
      data.isRunning ? 'running-node' : '',
      data.isScheduled ? 'scheduled-node' : '',
      data.signal ? 'signal-node' : '',
      data.meta ? 'meta-node' : '',
    ]"
    :style="
      data.isSelected
        ? { background: nodeSelectedBg, border: nodeSelectedBorder }
        : { background: nodeBg, border: 'none' }
    "
    role="button"
    tabindex="0"
  >
    <span v-if="data.meta" class="meta-label">{{
      data.label || data.uuid
    }}</span>
    <template v-else>
      {{ data.label || data.uuid }}
      <!-- <q-spinner
        v-if="data.isRunning"
        size="16px"
        color="white"
        class="q-ml-sm"
      />
      <q-spinner-dots
        v-if="data.isRunning"
        size="16px"
        color="white"
        class="q-ml-sm"
      />
      <q-spinner-facebook
        v-if="data.isRunning"
        size="16px"
        color="white"
        class="q-ml-sm"
      />
      <q-spinner-gears
        v-if="data.isRunning"
        size="16px"
        color="white"
        class="q-ml-sm"
      /> -->
      <q-linear-progress
        v-if="data.isRunning"
        dark
        rounded
        indeterminate
        color="white"
        class="q-mt-xs"
      />
    </template>
    <q-tooltip>
      Description: {{ data.description }}<br />
      {{ data.is_unique ? 'Unique' : 'Not Unique' }}<br />
      Concurrency: {{ data.concurrency }}
    </q-tooltip>
    <template v-if="data.signal">
      <Handle type="target" :position="Position.Top" />
      <Handle type="source" :position="Position.Bottom" />
    </template>
    <template v-else>
      <Handle type="target" :position="Position.Left" />
      <Handle type="source" :position="Position.Right" />
    </template>
  </div>
</template>

<style>
.vue-flow__handle {
  opacity: 0 !important;
  background: transparent !important;
  border: none !important;
}
.vue-flow__node {
  background: none !important;
  border: none !important;
}
.custom-node {
  color: white;
  border-radius: 4px;
  padding: 5px;
  width: 90px;
  text-align: center;
  cursor: pointer;
  font-size: 0.6em;
  overflow-wrap: break-word;
  box-shadow: 2px 6px 6px rgba(139, 136, 136, 0.66);
  transition: background 0.2s;
}
.custom-node:hover {
  filter: brightness(0.95);
}
.selected-node {
}
.errored-node {
  background: #d37b7b !important;
}
.failed-node {
  background: #f57741 !important;
}
.running-node {
}
.scheduled-node {
  background: rgba(139, 139, 136, 0.6) !important;
}
.signal-node {
  background: rgba(43, 146, 34, 0.6) !important;
  border-radius: 30px !important;
  box-shadow: 2px 6px 6px rgba(139, 136, 136, 0.66);
  width: 50px !important;
  height: 50px !important;
  align-content: center !important;
  word-wrap: break-word !important;
}
.meta-node {
  background: #ab0ac0 !important;
  width: 20px !important;
  height: 20px !important;
  box-shadow: 0 2px 8px 0 rgba(141, 140, 140, 0.66);
  transform: rotate(45deg);
  display: flex;
  align-items: bottom;
  justify-content: center;
  position: relative;
  margin: 0 auto;
  overflow: visible;
}
.meta-label {
  display: inline-block;
  transform: rotate(-45deg);
  width: 80px;
  text-align: center;
  color: #fff;
  font-size: 0.7em;
  pointer-events: none;
}
</style>
