<template>
  <div class="vue-flow-container q-mb-md">
    <VueFlow
      ref="vueFlowInstance"
      :nodes="laidOutNodes"
      :edges="laidOutEdges"
      @node-click="onNodeClick"
      :max-zoom="5"
      :min-zoom="0.125"
      fit-view-on-init
      contenteditable="false"
      :nodes-draggable="true"
    >
      <template #node-custom="props">
        <CustomNode :data="props.data" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { VueFlow } from '@vue-flow/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import CustomNode from '~/components/CustomNode.vue';
import { defineProps } from 'vue';

const props = defineProps({
  nodes: {
    type: Array,
    required: true,
  },
  edges: {
    type: Array,
    required: true,
  },
});

// ELK layout function
const elk = new ELK();
async function layoutNodes(nodesArr, edgesArr) {
  // Group nodes by type and parent
  const services = nodesArr.filter((n) => n.nodeType === 'service');
  const routines = nodesArr.filter((n) => n.nodeType === 'routine');
  const tasks = nodesArr.filter((n) => n.nodeType === 'task');

  // Build nested children: service > routine > task
  const elkServices = services.map((service) => {
    const elkRoutines = routines
      .filter((r) => r.parentNode === service.id)
      .map((routine) => {
        const elkTasks = tasks
          .filter((t) => t.parentNode === routine.id)
          .map((task) => ({
            id: task.id,
            width: 70,
            height: 40,
            ...task,
          }));
        return {
          id: routine.id,
          width: 400,
          height: 250,
          ...routine,
          children: elkTasks,
          layoutOptions: {
            'elk.padding': '[top=60,left=60,bottom=60,right=60]',
            'elk.spacing.nodeNode': '40',
            'elk.align': 'CENTER', // center task graph in routine
          },
        };
      });
    return {
      id: service.id,
      width: 600,
      height: 350,
      ...service,
      children: elkRoutines,
      layoutOptions: {
        'elk.padding': '[top=40,left=40]',
        'elk.spacing.nodeNode': '80',
        'elk.align': 'CENTER', // center routine in service
      },
    };
  });

  // Only task-to-task edges
  const elkEdges = edgesArr.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
    type: edge.type || 'default',
    style: edge.style || { stroke: '#1976d2', strokeWidth: 2 },
  }));

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '100', // more space between services
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    },
    children: elkServices,
    edges: elkEdges,
  };

  const layouted = await elk.layout(elkGraph);

  // Flatten all nodes for VueFlow, preserving positions
  function flattenNodes(elkNode) {
    let flat = [];
    if (elkNode.children) {
      elkNode.children.forEach((child) => {
        flat = flat.concat(flattenNodes(child));
      });
    }
    if (elkNode.id !== 'root') {
      flat.push({
        ...nodesArr.find((n) => n.id === elkNode.id),
        position: { x: elkNode.x, y: elkNode.y },
      });
    }
    return flat;
  }
  return flattenNodes(layouted);
}

const laidOutNodes = ref([]);
const laidOutEdges = ref([]);

async function updateLayout(newNodes, newEdges) {
  // Layout nodes
  laidOutNodes.value = await layoutNodes(newNodes, newEdges);
  // Ensure edges have required fields and type
  laidOutEdges.value = (newEdges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type || 'default',
    style: edge.style || { stroke: '#1976d2', strokeWidth: 2 },
    ...edge,
  }));
}

watch(
  () => [props.nodes, props.edges],
  ([newNodes, newEdges]) => {
    updateLayout(newNodes, newEdges);
  },
  { immediate: true, deep: true }
);
</script>

<style>
.vue-flow-container {
  position: relative;
  min-width: 50dvw;
  max-width: 80dvw;
  height: 50dvh;
  box-shadow: 0 1px 6px 0 rgba(105, 105, 105, 0.5);
  border-radius: 20px;
  margin: 10px;
}
</style>
