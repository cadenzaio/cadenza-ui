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
  isParent?: boolean;
  sectionNodeBg?: string | (() => string);
}

const props = defineProps<{ data: NodeData }>();

import { computed } from 'vue';
import { useAppStore } from '~/stores/app';
import { colors, useQuasar } from 'quasar';

const appStore = useAppStore();
const currentSection = appStore.currentSection;
const $q = useQuasar();

const nodeBg = computed(() => {
  if (props.data.sectionNodeBg) {
    return typeof props.data.sectionNodeBg === 'function'
      ? props.data.sectionNodeBg()
      : props.data.sectionNodeBg;
  }
  switch (currentSection) {
    case 'system':
      return colors.changeAlpha(colors.getPaletteColor('primary'), 0.6);
    case 'serviceActivity':
      return colors.changeAlpha(colors.getPaletteColor('warning'), 0.6);
    case 'traces':
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
    case 'system':
      return colors.getPaletteColor('primary');
    case 'serviceActivity':
      return colors.getPaletteColor('warning');
    case 'traces':
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
      data.isParent ? 'parent-node' : '',
    ]"
    :style="
      data.isSelected
        ? {
            ...(data.signal ? {} : { background: nodeSelectedBg }),
            border: nodeSelectedBorder,
            boxShadow: `2px 6px 6px ${
              typeof nodeBg === 'string' ? nodeBg : nodeBg
            }`,
          }
        : {
            ...(data.signal ? {} : { background: nodeSelectedBg }),
            border: 'none',
            boxShadow: `2px 6px 6px ${
              typeof nodeBg === 'string' ? nodeBg : nodeBg
            }`,
          }
    "
    role="button"
    tabindex="0"
  >
    <template v-if="data.meta">
      <span class="meta-label">{{ data.label || data.uuid }}</span>
    </template>
    <template v-else>
      <span class="node-label" :title="data.label">{{ (data.label || data.uuid).slice(0, 20) }}</span>
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
      Name: {{ data.label || data.uuid }}<br />
      Description: {{ data.description }}<br />
      {{ data.is_unique ? 'Unique' : 'Not Unique' }}<br />
      Concurrency: {{ data.concurrency }}<br/>
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
  margin: 0 !important;
}
.custom-node {
  color: white;
  border-radius: 4px;
  text-align: left;
  cursor: pointer;
  font-size: 0.7em;
  overflow-wrap: break-word;
  transition: background 0.2s;
  padding: 5px;


}
.custom-node:hover {
  filter: brightness(0.75);
}

.errored-node {
  background: #d37b7b !important;
  box-shadow: 2px 6px 6px #ff000069 !important;
}
.failed-node {
  background: #d37b7b !important;
}
.running-node {
  box-shadow: 2px 6px 6px rgba(139, 136, 136, 0.66);
}
.scheduled-node {
  background: rgba(139, 139, 136, 0.6) !important;
  box-shadow: 2px 6px 6px rgba(189 188 188 / 0.66) !important;
}
.signal-node {
  /* Keep background fully transparent to let the scan band show clearly */
  background: transparent !important;
  box-shadow: none !important;
  align-content: center !important;
  word-wrap: break-word !important;
  color: #08c011 !important;
}

/* Updated animation for signal-node */
.signal-node {
  position: relative;
  overflow: hidden;
}
.signal-node::before,
.signal-node::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border: 2px solid rgba(8, 192, 17, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: expand-ring 1.5s ease-out infinite;
}
.signal-node::after {
  animation-delay: 0.15s; /* Delay the second ring to overtake the first */
}

@keyframes expand-ring {
  0% {
    width: 0;
    height: 0;
    opacity: 1;
  }
  100% {
    width: 200%;
    height: 200%;
    opacity: 0;
  }
}

/* Burn / glow effect so text remains visible over the gradient */
.signal-node span {
  position: relative;
  z-index: 2;
}
.parent-node {
  background: rgba(81 83 83 / 0.22) !important;
  box-shadow: 2px 6px 6px rgba(189, 188, 188, 0.66) !important;
  height: 100%;
  width: 100%;
  padding: 10px;
  margin: 0;
}
.meta-node {
  background: #ab0ac0 !important;
  width: 30px !important;
  height: 30px !important;
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
.node-label {
  display: inline-block;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.node-label:hover {
  white-space: normal;
  overflow: visible;
}
</style>
