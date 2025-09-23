<template>
  <div class="vue-flow-container q-mb-md">
    <div v-if="loading" class="loading-center-container">
      <q-spinner :color="sectionColor" size="10em" class="loading-spinner" />
      <q-badge
        outline
        :color="sectionColor"
        label="Loading Map ..."
        class="loading-badge"
      />
    </div>
    <VueFlow
      ref="vueFlowInstance"
      :nodes="laidOutNodes"
      :edges="laidOutEdges"
      @node-click="onNodeClick"
      :max-zoom="5"
      :min-zoom="0"
      fit-view-on-init
      contenteditable="false"
      :nodes-draggable="false"
    >
      <template #node-custom="props">
        <CustomNode :data="{ ...props.data, sectionNodeBg: sectionNodeBg }" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { VueFlow } from '@vue-flow/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import CustomNode from '~/components/CustomNode.vue';
import { defineProps } from 'vue';
import { useAppStore } from '~/stores/app';
import { colors } from 'quasar';

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
const loading = ref(false);

async function updateLayout(newNodes, newEdges) {
  loading.value = true;
  try {
    laidOutNodes.value = await layoutNodes(newNodes, newEdges);
    laidOutEdges.value = (newEdges || []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'default',
      style: { stroke: sectionNodeBg.value, strokeWidth: 2 },
      ...edge,
    }));
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.nodes, props.edges],
  ([newNodes, newEdges]) => {
    updateLayout(newNodes, newEdges);
  },
  { immediate: true, deep: true }
);

const appStore = useAppStore();
const currentSection = computed(() => appStore.currentSection);
const sectionColor = computed(() => {
  switch (currentSection.value) {
    case 'system':
      return 'primary';
    case 'serviceActivity':
      return 'warning';
    case 'traces':
      return 'secondary';
    case 'meta':
      return 'accent';
    case 'help':
      return 'grey-8';
    default:
      return 'secondary';
  }
});
const sectionNodeBg = computed(() => {
  switch (currentSection.value) {
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

.loading-center-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  min-height: 300px;
  min-width: 300px;
}
.loading-spinner {
  margin-bottom: 24px;
}
.loading-badge {
  font-size: 1.2em;
}
</style>
