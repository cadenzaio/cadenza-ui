<template>
  <div class="vue-flow-container q-mb-md">
    <div v-if="filtered" class="back-btn-container">
      <q-btn
        round
        dense
        icon="arrow_back"
        color="primary"
        @click="resetFilter"
        class="back-btn"
      />
    </div>
    <div v-if="loading" class="loading-center-container">
      <q-spinner :color="sectionColor" size="10em" class="loading-spinner" />
      <q-badge
        outline
        :color="sectionColor"
        label="Loading Map ..."
        class="loading-badge"
      />
    </div>
    <div v-else-if="!loading && displayedNodes.length === 0" class="no-data-overlay">
      <q-icon 
        name="account_tree" 
        :color="sectionColor" 
        size="8em" 
        class="no-data-icon" 
      />
      <q-badge
        outline
        :color="sectionColor"
        label="Nothing to map"
        class="no-data-badge"
      />
    </div>
    <VueFlow
      ref="vueFlowInstance"
      :nodes="displayedNodes"
      :edges="displayedEdges"
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
      <MiniMap v-if="showMiniMap" />
    </VueFlow>
  </div>
</template>

<script setup>
const resetFilter = () => {
  // Hide filtered map immediately
  loading.value = true;
  displayedNodes.value = [];
  displayedEdges.value = [];
  // Reload the original map layout
  updateLayout(props.nodes, props.edges);
  filtered.value = false;
};
import { ref, watch, computed, onMounted } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';
import ELK from 'elkjs/lib/elk.bundled.js';
import CustomNode from '~/components/CustomNode.vue';

// Helper: get chain after a node (service, routine, task)
const getChainAfterNode = (nodeId) => {
  const chain = [];
  let currentId = nodeId;
  const visited = new Set();
  while (currentId) {
    const node = fullNodes.find((n) => n.id === currentId);
    if (!node || visited.has(currentId)) break;
    chain.push(node);
    visited.add(currentId);
    const nextEdge = fullEdges.find((e) => e.source === currentId);
    currentId = nextEdge ? nextEdge.target : null;
  }
  return chain;
};

const onNodeClick = (node) => {
  console.log('[NestedFlowMap] onNodeClick called:', node);
  const clickedNode = node.node || node; // support both payload and direct node
  if (clickedNode.nodeType === 'service') {
    // BFS to find all downstream services
    const serviceChain = [];
    const visited = new Set();
    const queue = [clickedNode.id];
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const serviceNode = fullNodes.find(
        (n) => n.id === currentId && n.nodeType === 'service'
      );
      if (serviceNode) {
        serviceChain.push(serviceNode);
        // Find all outgoing edges to other services
        const nextEdges = fullEdges.filter(
          (e) =>
            e.source === currentId &&
            fullNodes.find((n) => n.id === e.target && n.nodeType === 'service')
        );
        for (const edge of nextEdges) {
          if (!visited.has(edge.target)) {
            queue.push(edge.target);
          }
        }
      }
    }
    // For each service, include its routines and tasks
    const idsToShow = new Set();
    for (const service of serviceChain) {
      idsToShow.add(service.id);
      // Routines whose parentNode is this service
      const routines = fullNodes.filter(
        (n) => n.nodeType === 'routine' && n.parentNode === service.id
      );
      for (const routine of routines) {
        idsToShow.add(routine.id);
        // Tasks whose parentNode is this routine
        const tasks = fullNodes.filter(
          (n) => n.nodeType === 'task' && n.parentNode === routine.id
        );
        for (const task of tasks) {
          idsToShow.add(task.id);
        }
      }
    }
    displayedNodes.value = fullNodes.filter((n) => idsToShow.has(n.id));
    displayedEdges.value = fullEdges.filter(
      (e) => idsToShow.has(e.source) && idsToShow.has(e.target)
    );
    filtered.value = true;
    console.log('[NestedFlowMap] Filtered node IDs:', Array.from(idsToShow));
  }
};

onMounted(() => {
  console.log('[NestedFlowMap] Mounted.');
  console.log(
    '[NestedFlowMap] onNodeClick (should be function):',
    typeof onNodeClick
  );
});
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

// Filtering state
const filtered = ref(false);
const displayedNodes = ref([]);
const displayedEdges = ref([]);
let fullNodes = [];
let fullEdges = [];
let filterChain = [];

async function updateLayout(newNodes, newEdges) {
  loading.value = true;
  try {
    const nodes = await layoutNodes(newNodes, newEdges);
    const edges = (newEdges || []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type || 'default',
      style: { stroke: sectionNodeBg.value, strokeWidth: 4 },
      ...edge,
    }));
    laidOutNodes.value = nodes;
    laidOutEdges.value = edges;
    fullNodes = nodes;
    fullEdges = edges;
    displayedNodes.value = nodes;
    displayedEdges.value = edges;

    // Zoom to fit width of map
    await nextTick();
    if (
      vueFlowInstance.value &&
      typeof vueFlowInstance.value.fitView === 'function'
    ) {
      vueFlowInstance.value.fitView({
        padding: 0,
        includeHiddenNodes: true,
        direction: 'horizontal',
      });
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.nodes, props.edges],
  ([newNodes, newEdges]) => {
    updateLayout(newNodes, newEdges);
    filtered.value = false;
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

const showMiniMap = ref(false);

function checkShowMiniMap() {
  // Get bounding box of all nodes
  const minX = Math.min(...displayedNodes.value.map((n) => n.position.x));
  const maxX = Math.max(...displayedNodes.value.map((n) => n.position.x));
  const minY = Math.min(...displayedNodes.value.map((n) => n.position.y));
  const maxY = Math.max(...displayedNodes.value.map((n) => n.position.y));
  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;

  // Get container size
  const container = document.querySelector('.vue-flow-container');
  if (!container) return;
  const viewportWidth = container.offsetWidth;
  const viewportHeight = container.offsetHeight;

  showMiniMap.value = mapWidth > viewportWidth || mapHeight > viewportHeight;
}

watch([displayedNodes, displayedEdges], () => {
  checkShowMiniMap();
});

onMounted(() => {
  checkShowMiniMap();
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
.no-data-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  z-index: 5;
}
.no-data-icon {
  margin-bottom: 24px;
  opacity: 0.6;
}
.no-data-badge {
  font-size: 1.2em;
}
.back-btn-container {
  position: absolute;
  top: 10px;
  right: 20px;
  z-index: 10;
}
.back-btn {
  min-width: 80px;
}
</style>
