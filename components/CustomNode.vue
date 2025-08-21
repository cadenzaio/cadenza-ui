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
  signal?: boolean;
  meta?: boolean;
}

const props = defineProps<{ data: NodeData }>();
</script>

<template>
  <div
    :class="[
      'custom-node',
      data.isSelected ? 'selected-node' : '',
      data.errored ? 'errored-node' : '',
      data.failed ? 'failed-node' : '',
      data.signal ? 'signal-node' : '',
      data.meta ? 'meta-node' : '',
    ]"
    role="button"
    tabindex="0"
  >
    <span v-if="data.meta" class="meta-label">{{
      data.label || data.uuid
    }}</span>
    <template v-else>
      {{ data.label || data.uuid }}
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
.vue-flow__node {
  background: none !important;
  border: none !important;
}
.custom-node {
  background: #7abfd2;
  color: white;
  border-radius: 4px;
  padding: 5px;
  width: 90px;
  text-align: center;
  cursor: pointer;
  font-size: 0.6em;
  overflow-wrap: break-word;
}

.custom-node:hover {
  background: #6aa8b8;
}

.selected-node {
  background: #f5b041 !important;
  box-shadow: 6px 6px #3332313b !important;
}

.errored-node {
  background: #d37b7b !important;
}

.failed-node {
  background: #f57741 !important;
}
.signal-node {
  background: #2b9222 !important;
  border-radius: 30px !important;
  box-shadow: 0 2px 8px 0 rgba(141 140 140 / 0.66);
  width: 50px !important;
  height: 50px !important;
  align-content: center !important;
  word-wrap: break-word !important;
}

.meta-node {
  background: #ab0ac0 !important;
  width: 30px !important;
  height: 30px !important;
  border-radius: 0 !important;
  box-shadow: 0 2px 8px 0 rgba(141 140 140 / 0.66);
  transform: rotate(45deg);
  display: flex;
  align-items: center;
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
