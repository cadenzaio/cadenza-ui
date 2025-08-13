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
}

// Define props with type
defineProps<{ data: NodeData }>();
</script>

<template>
  <div
    :class="['custom-node', data.isSelected ? 'selected-node' : '', data.errored ? 'errored-node' : '', data.failed ? 'failed-node' : '']"
    role="button"
    tabindex="0"
  >
    {{ data.label || data.uuid }}
    <q-tooltip>
      Description: {{ data.description }}<br />
      {{ data.is_unique ? 'Unique' : 'Not Unique' }}<br />
      Concurrency: {{ data.concurrency }}
    </q-tooltip>
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
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
</style>
