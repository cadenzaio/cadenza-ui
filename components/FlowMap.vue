<template>
  <div :class="['vue-flow-container q-mb-md', { 'full-width': props.fullWidth }]">
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
    </div>
    <VueFlow
      ref="vueFlowInstance"
      :nodes="nodes"
      :edges="edges"
      @node-click="onNodeClick"
      :min-zoom="minZoom"
      :max-zoom="maxZoom"
      :zoom-on-scroll="false"
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

<script setup lang="ts">
import CustomNode from '~/components/CustomNode.vue';
import { ref, watch, nextTick, onMounted } from 'vue';
import { VueFlow, type Node, type Edge, type Position } from '@vue-flow/core';
import ELK from 'elkjs/lib/elk.bundled.js';

// Define props - generic flow item interface
interface FlowItem {
  id?: string;
  label?: string;
  name?: string;
  description?: string;
  errored?: boolean;
  failed?: boolean;
  isUnique?: boolean;
  previousId?: string | string[];
  previousTaskExecutionId?: string | string[];
  previousExecutions?: Array<{
    previousTaskExecutionId: string;
    previousTaskName: string;
  }>;
  [key: string]: unknown;
}

const props = defineProps<{
  items: FlowItem[];
  idField?: string;
  labelField?: string;
  previousField?: string;
  fullWidth?: boolean;
}>();

// Define emits
const emit = defineEmits<{
  'item-selected': [item: FlowItem];
}>();

const router = useRouter();

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
const vueFlowInstance = ref<InstanceType<typeof VueFlow> | null>(null);
// Zoom slider state and bounds
const minZoom = 0.05;
const maxZoom = 1.5;
const zoom = ref<number>(1);

// Keep Vue Flow viewport in sync with the slider
watch(zoom, async (val) => {
  if (!vueFlowInstance.value) return;
  const api = vueFlowInstance.value as any;
  if (typeof api.zoomTo === 'function') {
    try {
      await api.zoomTo(val);
    } catch (err) {
      // ignore zoom errors
    }
  } else if (typeof api.setViewport === 'function') {
    try {
      await api.setViewport({ x: 0, y: 0, zoom: val });
    } catch (err) {
      // ignore
    }
  }
});

onMounted(async () => {
  // Initialize slider from current viewport if available
  await nextTick();
  if (!vueFlowInstance.value) return;
  const api = vueFlowInstance.value as any;
  try {
    const vp = typeof api.getViewport === 'function' ? await api.getViewport() : null;
    if (vp && typeof vp.zoom === 'number') {
      zoom.value = vp.zoom;
    }
  } catch (err) {
    // ignore
  }
});

// Helper functions to get field values with fallbacks
const getId = (item: FlowItem): string => {
  // Prefer `name` as the primary identifier (DB now uses name)
  const idField = props.idField || 'name';
  return (
    ((item as any)[idField] as string) || (item['uuid'] as string) || item.id || ''
  );
};

const getLabel = (item: FlowItem): string => {
  const labelField = props.labelField || 'label';
  return (
    (item[labelField] as string) ||
    item.label ||
    item.name ||
    item.id ||
    (item['uuid'] as string) ||
    getId(item)
  );
};

const getPreviousIds = (item: FlowItem): string[] => {
  const previousField = props.previousField || 'previousId';

  // First check for the proper previousExecutions array (from tasksInRoutines endpoint)
  if (item.previousExecutions && Array.isArray(item.previousExecutions)) {
    return item.previousExecutions
      .map((exec) => (exec.previousTaskExecutionId ?? exec.previousTaskName) as string)
      .filter((id) => id != null);
  }

  // Check for array fields from the individual task execution endpoint
  const possibleArrayFields = [
    item.previousTaskExecutionId,
    (item as any).previousTaskExecutionIds,
    item[previousField],
  ];

  for (const arrayField of possibleArrayFields) {
    if (Array.isArray(arrayField)) {
      return arrayField.filter((id) => id != null);
    }
  }

  // Fallback to single value for backward compatibility
  const singleValue =
    item[previousField] || item.previousTaskExecutionId || item.previousId || null;
  return singleValue ? [singleValue as string] : [];
};

// Function to create layout using ELK
const elk = new ELK();
async function createLayout(nodes: Node[], edges: Edge[]) {
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.spacing.nodeNode': '60',
      'elk.layered.nodePlacement.strategy': 'SIMPLE',
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: 120,
      height: 50,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const layouted = await elk.layout(elkGraph);

  // Increase spacing for isolated nodes (nodes with no incoming/outgoing edges)
  try {
    const isolatedIds = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      isolatedIds.delete(e.source as string);
      isolatedIds.delete(e.target as string);
    }
    const layoutChildren = layouted.children ?? [];

    // 1) Spread isolated nodes so they don't cluster
    if (isolatedIds.size > 1) {
      const extraSpacing = 120; // pixels to add between successive isolated nodes
      const isolatedLayoutNodes = layoutChildren
        .filter((n: any) => isolatedIds.has(n.id))
        .sort((a: any, b: any) => (a.x ?? 0) - (b.x ?? 0));

      isolatedLayoutNodes.forEach((ln: any, idx: number) => {
        ln.x = (ln.x ?? 0) + idx * extraSpacing;
      });
    }

    // 2) Enforce a minimum horizontal gap for nodes that share the same row (y)
    // Group nodes by rounded y to detect rows. This prevents nodes aligned on the
    // same y from being placed too close together horizontally.
    const rowTolerance = 12; // px tolerance to consider nodes on same row
    const minHorizontalGap = 80; // minimum gap in px between node bounds

    const byRow = new Map<number, any[]>();
    for (const n of layoutChildren) {
      const y = Math.round((n.y ?? 0) / rowTolerance) * rowTolerance;
      const arr = byRow.get(y) || [];
      arr.push(n);
      byRow.set(y, arr);
    }

    for (const [, rowNodes] of byRow) {
      if (rowNodes.length <= 1) continue;
      // sort by x coordinate
      rowNodes.sort((a: any, b: any) => (a.x ?? 0) - (b.x ?? 0));
      for (let i = 1; i < rowNodes.length; i++) {
        const prev = rowNodes[i - 1];
        const cur = rowNodes[i];
        const prevRight = (prev.x ?? 0) + (prev.width ?? 120);
        const desiredX = prevRight + minHorizontalGap;
        if ((cur.x ?? 0) < desiredX) {
          const shift = desiredX - (cur.x ?? 0);
          // shift current node to desired position
          cur.x = (cur.x ?? 0) + shift;
          // also shift any subsequent nodes in this row to avoid overlap cascading
          for (let j = i + 1; j < rowNodes.length; j++) {
            rowNodes[j].x = (rowNodes[j].x ?? 0) + shift;
          }
        }
      }
    }
  } catch (err) {
    // Don't block layout if spacing adjustment fails
    // eslint-disable-next-line no-console
    console.warn('Failed to adjust isolated node spacing:', err);
  }

  return nodes.map((node) => {
    const layoutNode = (layouted.children ?? []).find((n) => n.id === node.id);
    return {
      ...node,
      position: layoutNode
        ? { x: layoutNode.x ?? 0, y: layoutNode.y ?? 0 }
        : { x: 0, y: 0 },
    };
  });
}
//------------------------------------------------------------------------------
// Function to convert items to nodes and edges
// Modify processFlowItems to handle duplicate nodes
async function processFlowItems(items: FlowItem[]) {
  if (!items || items.length === 0) {
    nodes.value = [];
    edges.value = [];
    return;
  }

  const nodeMap = new Map<string, Node>();
  const newEdges: Edge[] = [];

  // Step 1: Process all nodes first
  items.forEach((item: FlowItem) => {
    const nodeId = getId(item);
    const nodeData = {
      label: getLabel(item),
      uuid: nodeId,
      description: item.description || '',
      is_unique: item.isUnique || item.is_unique || false,
      concurrency: 1,
      isSelected: item.isSelected || false,
      errored: item.errored ?? false,
      failed: item.failed ?? false,
      isRunning: item.is_running ?? false,
      isScheduled: item.is_scheduled ?? false,
      // Detect signal nodes from several possible shapes returned by APIs
      signal:
        item.signal === true ||
        (item as any).nodeType === 'signal' ||
        (item as any).type === 'signal' ||
        String(nodeId).startsWith('signal::'),
      item: item,
    };

    if (!nodeMap.has(nodeId)) {
      nodeMap.set(nodeId, {
        id: nodeId,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: nodeData,
      });
    }
  });

  // Step 2: Process edges after all nodes are added
  items.forEach((item: FlowItem) => {
    const nodeId = getId(item);
    const previousIds = getPreviousIds(item);

    previousIds.forEach((previousId: string) => {
      if (!previousId || !nodeMap.has(previousId)) {
        return;
      }
      const sourceId = previousId;
      const targetId = nodeId;
      // mark edge as a signal edge if either endpoint node data indicates a signal
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);
      const isSignal = Boolean(
        (sourceNode && (sourceNode.data as any)?.signal) ||
        (targetNode && (targetNode.data as any)?.signal)
      );

      newEdges.push({
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        data: { signal: isSignal },
        animated: isSignal,
      });
    });
  });

  const layoutedNodes = await createLayout(Array.from(nodeMap.values()), newEdges);
  nodes.value = layoutedNodes;
  edges.value = newEdges;

  // wait for DOM to update, then fit the view so the whole graph is visible
  try {
    await nextTick();
    // slight delay to ensure SVG/canvas rendered
    await new Promise((r) => setTimeout(r, 30));
    if (vueFlowInstance.value && typeof (vueFlowInstance.value as any).fitView === 'function') {
      try {
        (vueFlowInstance.value as any).fitView({ padding: 0.05 });
      } catch (err) {
        // don't block if fitView fails
        // eslint-disable-next-line no-console
        console.warn('fitView failed:', err);
      }
    }
  } catch (err) {
    // ignore fitView errors
  }
}

// Handle node click
import type { NodeMouseEvent } from '@vue-flow/core';
function onNodeClick(event: NodeMouseEvent) {
  const clickedNode = event.node;
  if (clickedNode?.data?.item) {
    emit('item-selected', clickedNode.data.item as FlowItem);
  }
}

// Watch for changes in items
watch(
  () => props.items,
  (newItems) => {
    if (!newItems || newItems.length === 0) {
      console.warn('Received empty items array. Skipping processing.');
      nodes.value = [];
      edges.value = [];
      return;
    }
    processFlowItems(newItems);
  },
  { immediate: true, deep: true }
);
</script>

<style scoped>
.vue-flow-container {
  position: relative;
  min-width: 50dvw;
  max-width: 80dvw;
  height: 50dvh;
  box-shadow: 0 1px 6px 0 rgba(105, 105, 105, 0.5);
  border-radius: 20px;
  margin: 10px;
}

.vue-flow-container.full-width {
  min-width: auto;
  max-width: none;
  width: 100%;
}
/* Zoom slider overlay */
.zoom-slider {
  position: absolute;
  top: 10px;
  right: 12px;
  background: rgba(255, 255, 255, 0.92);
  padding: 6px 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.08);
  z-index: 10;
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
</style>
