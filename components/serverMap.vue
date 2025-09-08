<template>
  <div class="map-container q-ma-md">
    <div v-if="loading" class="text-center q-pa-md">Loading server map...</div>
    <div v-else-if="nodes.length === 0" class="text-center q-pa-md">
      No active servers found
    </div>
    <VueFlow
      v-else
      :nodes="nodes"
      :edges="edges"
      @node-click="onNodeClick"
      :fitViewOnInit="true"
      contenteditable="false"
      :nodes-draggable="false"
      v-bind="$attrs"
      :max-zoom="1.5"
      :min-zoom="-5"
    />
  </div>
</template>

<script setup lang="ts">
import type { Node, Edge } from '@vue-flow/core';
import { VueFlow } from '@vue-flow/core';

const props = defineProps<{
  nodes: Node[];
  edges: Edge[];
  loading: boolean;
}>();

const emit = defineEmits(['nodeSelected']);
function onNodeClick({ event, node }: { event: any; node: Node }) {
  emit('nodeSelected', node.id);
}
</script>

<style>
@import '@vue-flow/core/dist/style.css';

.map-container {
  position: relative;
  min-width: 35dvw;
  max-width: 80dvw;
  height: 55dvh;
  box-shadow: 0 1px 6px 0 rgba(105, 105, 105, 0.5);
  border-radius: 20px;
  margin: 10px;
  background: rgba(255, 255, 255, 0.082);
}

.vue-flow__node {
  background: #7abfd2;
  color: white;
  border-radius: 4px;
  padding: 5px;
  border: 1px solid #333;
}

.vue-flow__node .vue-flow__handle {
  background: #333;
}
</style>
