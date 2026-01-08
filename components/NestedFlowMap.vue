<template>
  <div ref="containerRef" :class="['vue-flow-container q-mb-md', { 'fullscreen-mode': isFullscreen }, fullscreenPolkaClass]">
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
    <div class="zoom-slider" aria-hidden="false">
      <label class="zoom-label">Zoom</label>
      <input
        type="range"
        v-model.number="zoom"
        :min="minZoom"
        :max="maxZoom"
        step="0.01"
        aria-label="Zoom slider"
      />
      <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
      <q-btn
        flat
        dense
        round
        icon="fit_screen"
        @click="fitToWindow"
        class="q-ml-md"
        title="Fit to Window"
      />
      <q-btn
        flat
        dense
        round
        :icon="isFullscreen ? 'fullscreen_exit' : 'fullscreen'"
        @click="toggleFullscreen"
        class="q-ml-xs"
        title="Toggle Fullscreen"
      />
    </div>
    <VueFlow
      ref="vueFlowInstance"
      :nodes="displayedNodes"
      :edges="displayedEdges"
      @node-click="onNodeClick"
      :max-zoom="maxZoom"
      :min-zoom="minZoom"
      :zoom-on-scroll="false"
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
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';
import ELK from 'elkjs/lib/elk.bundled.js';
import CustomNode from '~/components/CustomNode.vue';
import { useAppStore } from '~/stores/app';
import { colors, useQuasar } from 'quasar';
import { useRouter } from 'vue-router';

const resetFilter = () => {
  loading.value = true;
  displayedNodes.value = [];
  displayedEdges.value = [];
  updateLayout(props.nodes, props.edges);
  filtered.value = false;
};

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

const emit = defineEmits(['item-selected']);

const onNodeClick = (...args) => {
  const maybeEvent = args[0];
  const maybeNode = args[1];
  const payload = maybeNode || (maybeEvent && maybeEvent.node) || maybeEvent;
  const clickedNode = payload || null;
  if (!clickedNode) return;

  if (clickedNode.nodeType === 'service') {
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

    const idsToShow = new Set();
    for (const service of serviceChain) {
      idsToShow.add(service.id);
      const tasks = fullNodes.filter(
        (n) => n.nodeType === 'task' && n.parentNode === service.id
      );
      for (const task of tasks) {
        idsToShow.add(task.id);
      }
      const signals = fullNodes.filter(
        (n) => n.nodeType === 'signal' && n.parentNode === service.id
      );
      for (const sig of signals) idsToShow.add(sig.id);
    }
    displayedNodes.value = fullNodes.filter((n) => idsToShow.has(n.id));
    displayedEdges.value = fullEdges.filter(
      (e) => idsToShow.has(e.source) && idsToShow.has(e.target)
    );
    filtered.value = true;
    console.log('[NestedFlowMap] Filtered node IDs:', Array.from(idsToShow));
    emit('item-selected', clickedNode);
  }
  else if (clickedNode.nodeType === 'task') {
    emit('item-selected', clickedNode);
  } else if (clickedNode.nodeType === 'signal') {
    emit('item-selected', clickedNode);
  }
};

const vueFlowInstance = ref(null);
const containerRef = ref(null);
const isFullscreen = ref(false);
const $q = useQuasar();

const fullscreenPolkaClass = computed(() => {
  if (!isFullscreen.value) return '';
  return $q && $q.dark.isActive ? 'polka-dark' : 'polka-light';
});

function fitToWindow() {
  if (!vueFlowInstance.value) return;
  const api = vueFlowInstance.value;
  if (typeof api.fitView === 'function') {
    try {
      api.fitView({ padding: 0.1, maxZoom: 1 });
    } catch (err) {
      console.error('Error fitting view:', err);
    }
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
  if (isFullscreen.value) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

const minZoom = 0.05;
const maxZoom = 5;
const zoom = ref(1);

watch(zoom, async (val) => {
  if (!vueFlowInstance.value) return;
  const api = vueFlowInstance.value;
  if (api && typeof api.zoomTo === 'function') {
    try {
      await api.zoomTo(val);
    } catch (err) {
    }
  } else if (api && typeof api.setViewport === 'function') {
    try {
      await api.setViewport({ x: 0, y: 0, zoom: val });
    } catch (err) {
    }
  }
});

onMounted(async () => {
  typeof onNodeClick;
  await nextTick();
  if (!vueFlowInstance.value) return;
  try {
    const vp = typeof vueFlowInstance.value.getViewport === 'function' ? await vueFlowInstance.value.getViewport() : null;
    if (vp && typeof vp.zoom === 'number') {
      zoom.value = vp.zoom;
    }
  } catch (err) {
  }
});

const props = defineProps({
  nodes: {
    type: Array,
    required: true,
    default: () => [],
  },
  edges: {
    type: Array,
    required: true,
    default: () => [],
  },
});

const appStore = useAppStore();
const currentSection = computed(() => appStore.currentSection);
const router = useRouter();
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

const elk = new ELK();
async function layoutNodes(nodesArr, edgesArr) {
  const services = nodesArr.filter((n) => n.nodeType === 'service');
  const routines = nodesArr.filter((n) => n.nodeType === 'routine');
  const tasks = nodesArr.filter((n) => n.nodeType === 'task');
  const signals = nodesArr.filter((n) => n.nodeType === 'signal');

  const elkServices = services.map((service) => {
    const serviceDirectTasks = tasks
      .filter((t) => t.parentNode === service.id)
      .map((task) => ({ id: task.id, width: 70, height: 40, ...task }));

    const elkChildren = [
      ...serviceDirectTasks,
      ...routines
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
            width: Math.max(400, elkTasks.length * 80),
            height: Math.max(250, elkTasks.length * 50),
            ...routine,
            children: elkTasks,
            layoutOptions: {
              'elk.padding': '[top=60,left=60,bottom=60,right=60]',
              'elk.spacing.nodeNode': '40',
              'elk.align': 'CENTER',
            },
          };
        }),
      ...signals
        .filter((s) => s.parentNode === service.id)
        .map((signal) => {
          const elkTasks = tasks
            .filter((t) => t.parentNode === signal.id)
            .map((task) => ({
              id: task.id,
              width: 70,
              height: 40,
              ...task,
            }));

          return {
            id: signal.id,
            width: Math.max(110, elkTasks.length * 80),
            height: Math.max(50, elkTasks.length * 50),
            ...signal,
            children: elkTasks,
            layoutOptions: {
              'elk.padding': '[top=60,left=60,bottom=60,right=60]',
              'elk.spacing.nodeNode': '60',
              'elk.align': 'CENTER',
            },
          };
        }),
    ];

    console.log('[ELK Layout] Service children:', elkChildren);

    return {
      id: service.id,
      width: Math.max(600, elkChildren.length * 100),
      height: Math.max(350, elkChildren.length * 80),
      ...service,
      children: elkChildren,
      layoutOptions: {
        'elk.padding': '[top=60,left=30,bottom=30,right=30]',
        'elk.spacing.nodeNode': '40',
        'elk.align': 'CENTER',
      },
    };
  });

  const elkEdges = edgesArr
    .map((edge) => {
      const sourceNode = nodesArr.find((n) => n.id === edge.source);
      const targetNode = nodesArr.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        console.warn('[ELK Layout] Skipping edge due to missing nodes:', {
          edge,
          missingSource: !sourceNode,
          missingTarget: !targetNode,
        });
        return null;
      }

      const isSignalEdge = Boolean(
        (sourceNode.nodeType === 'signal') ||
        (targetNode.nodeType === 'signal') ||
        (sourceNode.signal) ||
        (targetNode.signal) ||
        (edge.data && edge.data.signal)
      );

      return {
        id: edge.id || `${edge.source}-${edge.target}`,
        sources: [edge.source],
        targets: [edge.target],
        type: edge.type || 'default',
        style: isSignalEdge ? { strokeWidth: 2, stroke: sectionNodeBg.value } : (edge.style || { strokeWidth: 2 }),
        data: { ...(edge.data || {}), signal: isSignalEdge },
        animated: false,
        ...edge,
      };
    })
    .filter(Boolean);

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '110',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: [...elkServices],
    edges: elkEdges,
  };

  console.log('[ELK Graph Structure]:', elkGraph);

  const layouted = await elk.layout(elkGraph);

  console.log('[ELK Layout Result]:', layouted);

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
        width: elkNode.width,
        height: elkNode.height,
      });
    }
    return flat;
  }
  return flattenNodes(layouted);
}

const laidOutNodes = ref([]);
const laidOutEdges = ref([]);
const loading = ref(false);
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
    const edges = (newEdges || []).map((edge) => {
      if (!edge.source || !edge.target) {
        console.warn('[updateLayout] Edge skipped due to missing source or target:', {
          edge,
          reason: {
            missingSource: !edge.source,
            missingTarget: !edge.target,
          },
        });
        return null;
      }

      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      const isSignal = Boolean(
        (sourceNode && (sourceNode.nodeType === 'signal' || (sourceNode.data && sourceNode.data.signal))) ||
        (targetNode && (targetNode.nodeType === 'signal' || (targetNode.data && targetNode.data.signal))) ||
        (edge.data && edge.data.signal)
      );

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'default',
        style: isSignal ? { strokeWidth: 2, stroke: sectionNodeBg.value } : (edge.style || { strokeWidth: 2 }),
        data: { ...(edge.data || {}), signal: isSignal },
        animated: false,
        ...edge,
      };
    }).filter(Boolean);
    laidOutNodes.value = nodes;
    laidOutEdges.value = edges;
    fullNodes = nodes;
    fullEdges = edges;
    displayedNodes.value = nodes;
    displayedEdges.value = edges;

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

const showMiniMap = ref(false);

function checkShowMiniMap() {
  const minX = Math.min(...displayedNodes.value.map((n) => n.position.x));
  const maxX = Math.max(...displayedNodes.value.map((n) => n.position.x));
  const minY = Math.min(...displayedNodes.value.map((n) => n.position.y));
  const maxY = Math.max(...displayedNodes.value.map((n) => n.position.y));
  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;
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
.zoom-slider {
  position: absolute;
  top: 10px;
  right: 60px;
  background: rgba(255, 255, 255, 0.94);
  padding: 6px 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
  z-index: 12;
}
.zoom-slider .zoom-label {
  font-size: 12px;
  color: #444;
}
.zoom-slider input[type="range"] {
  width: 120px;
}
.zoom-slider .zoom-value {
  font-size: 12px;
  color: #333;
  min-width: 36px;
  text-align: right;
}
:deep(.zoom-slider .q-btn) {
  color: #444;
}

.vue-flow-container.fullscreen-mode {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw !important;
  height: 100vh !important;
  min-width: 100vw !important;
  max-width: 100vw !important;
  min-height: 100vh !important;
  max-height: 100vh !important;
  margin: 0;
  border-radius: 0;
  z-index: 9999;
  background-attachment: fixed;
  background-position: center;
}

.vue-flow-container.polka-light {
  background-image: radial-gradient(rgb(168, 167, 167) 5%, transparent 5%);
  background-position: 4px 4px;
  background-size: 19px 19px;
  background-color: rgb(255, 255, 255);
}

.vue-flow-container.polka-dark {
  background-image: radial-gradient(rgb(87, 87, 87) 5%, transparent 5%);
  background-position: 4px 4px;
  background-size: 19px 19px;
  background-color: rgb(0, 0, 0);
}
</style>
