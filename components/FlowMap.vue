<template>
  <div class="vue-flow-container q-mb-md">
    <VueFlow
      ref="vueFlowInstance"
      :nodes="nodes"
      :edges="edges"
      @node-click="onNodeClick"
      :max-zoom="1.5"
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
}>();

// Define emits
const emit = defineEmits<{
  'item-selected': [item: FlowItem];
}>();

const router = useRouter();

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
const vueFlowInstance = ref<InstanceType<typeof VueFlow> | null>(null);

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
      signal: item.signal === true,
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
      newEdges.push({
        id: `${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
      });
    });
  });

  const layoutedNodes = await createLayout(Array.from(nodeMap.values()), newEdges);
  nodes.value = layoutedNodes;
  edges.value = newEdges;
}

// Handle node click
import type { NodeMouseEvent } from '@vue-flow/core';
function onNodeClick(event: NodeMouseEvent) {
  const clickedNode = event.node;
  if (clickedNode?.data?.item) {
    emit('item-selected', clickedNode.data.item as FlowItem);
  }
}

// Watch for changes in items and process them
watch(
  () => props.items,
  (newItems) => {
    if (!newItems || newItems.length === 0) {
      nodes.value = [];
      edges.value = [];
      return;
    }

    processFlowItems(newItems).catch((err) => {
      console.error('Error processing flow items', err);
    });
  },
  { immediate: true }
);

</script>

<style scoped>
.vue-flow-container {
  max-width: 80dvw;
  height: 50dvh;
  box-shadow: 0 1px 6px 0 rgba(105, 105, 105, 0.5);
  border-radius: 20px;
  margin: 10px;
}
</style>
