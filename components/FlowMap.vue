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
      :nodes-draggable="false"
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
import dagre from 'dagre';

// Define props - generic flow item interface
interface FlowItem {
  id: string;
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
  [key: string]: any;
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
const vueFlowInstance = ref<any>(null);

// Helper functions to get field values with fallbacks
const getId = (item: any): string => {
  const idField = props.idField || 'id';
  return item[idField] || item.uuid || item.id;
};

const getLabel = (item: any): string => {
  const labelField = props.labelField || 'label';
  return item[labelField] || item.label || item.name || item.id || item.uuid;
};

const getPreviousIds = (item: any): string[] => {
  const previousField = props.previousField || 'previousId';

  // Debug logging for Task 6 specifically
  if (item.label === 'Task 6' || item.name === 'Task 6') {
    console.log('FlowMap: Debugging actual Task 6:', item);
    console.log('FlowMap: Task 6 previousExecutions:', item.previousExecutions);
    console.log(
      'FlowMap: Task 6 previousTaskExecutionId:',
      item.previousTaskExecutionId
    );
    console.log('FlowMap: Task 6 previousField value:', item[previousField]);
    console.log('FlowMap: All item properties:', Object.keys(item));
  }

  // First check for the proper previousExecutions array (from tasksInRoutines endpoint)
  if (item.previousExecutions && Array.isArray(item.previousExecutions)) {
    console.log(
      'FlowMap: Found previousExecutions array for',
      getLabel(item),
      ':',
      item.previousExecutions
    );
    return item.previousExecutions
      .map((exec: any) => exec.previousTaskExecutionId)
      .filter((id: any) => id != null);
  }

  // Check for array fields from the individual task execution endpoint
  const possibleArrayFields = [
    item.previousTaskExecutionId,
    item.previousTaskExecutionIds,
    item[previousField],
  ];

  for (const arrayField of possibleArrayFields) {
    if (Array.isArray(arrayField)) {
      console.log(
        'FlowMap: Found array field for',
        getLabel(item),
        ':',
        arrayField
      );
      return arrayField.filter((id) => id != null);
    }
  }

  // Fallback to single value for backward compatibility
  const singleValue =
    item[previousField] || item.previousTaskExecutionId || item.previousId;
  return singleValue ? [singleValue] : [];
};

// Function to create layout using dagre
function createLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 5, ranksep: 60 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 100, height: 50 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 50,
        y: nodeWithPosition.y - 25,
      },
    };
  });
}
//------------------------------------------------------------------------------
// Function to convert items to nodes and edges
// TEMPORARY: Inject signal nodes for demo
// --- BEGIN: TEMPORARY SIGNAL NODE INJECTION ---
function injectSignalNodes(items: any[]): any[] {
  const result = [...items];
  // Find Task 1 and Task 7
  const task1 = items.find(
    (item) => item.name === 'Task 1' || item.label === 'Task 1'
  );
  const task7 = items.find(
    (item) => item.name === 'Task 7' || item.label === 'Task 7'
  );

  // Add signal node before Task 1
  if (task1) {
    result.push({
      id: 'signal-1',
      signal: true,
      label: 'Signal 1',
      description: 'Signal node for Task 1',
      // No previousId, will connect as source
    });
    // Remove Task 1's previous connections (if any) for clarity
    if (task1.previousId) delete task1.previousId;
    if (task1.previousTaskExecutionId) delete task1.previousTaskExecutionId;
    if (task1.previousExecutions) delete task1.previousExecutions;
    // Add a custom field to link from signal-1
    task1._signalInjected = true;
  }

  // Add signal node after Task 7
  if (task7) {
    result.push({
      id: 'signal-2',
      signal: true,
      label: 'Signal 2',
      description: 'Signal node for Task 7',
      previousId: task7.id,
    });
  }
  return result;
}

// --- BEGIN: TEMPORARY SIGNAL NODE INJECTION ---
function processFlowItems(items: FlowItem[] | any[]) {
  // To revert to the original, comment out this function and uncomment the old version below.
  console.log('FlowMap: Processing flow items:', items);

  if (!items || items.length === 0) {
    console.log('FlowMap: No items data, clearing nodes and edges');
    nodes.value = [];
    edges.value = [];
    return;
  }

  // TEMP: inject signal nodes for demo
  const itemsWithSignals = injectSignalNodes(items);

  // Debug: log the structure of the first item to understand the API response
  if (itemsWithSignals.length > 0) {
    console.log('FlowMap: Sample item structure:', itemsWithSignals[0]);
    console.log('FlowMap: Sample item keys:', Object.keys(itemsWithSignals[0]));

    // Look for Task 6 in the dataset and log its specific structure
    const task6 = itemsWithSignals.find((item) => item.label === 'Task 6');
    if (task6) {
      console.log('FlowMap: Task 6 full object:', task6);
      console.log(
        'FlowMap: Task 6 previousTaskExecutionId type:',
        typeof task6.previousTaskExecutionId
      );
      console.log(
        'FlowMap: Task 6 previousTaskExecutionId value:',
        task6.previousTaskExecutionId
      );
    }
  }

  // Create nodes
  const newNodes: Node[] = itemsWithSignals.map((item: any) => {
    return {
      id: getId(item),
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: getLabel(item),
        uuid: getId(item),
        description: item.description || '',
        is_unique: item.isUnique || item.is_unique || false,
        concurrency: 1,
        isSelected: item.isSelected || false,
        errored: item.errored || false,
        failed: item.failed || false,
        signal: item.signal === true,
        item: item,
      },
    };
  });

  // Only assign nodes if all have type 'custom'
  const allCustom = newNodes.every((n) => n.type === 'custom');

  // Create edges based on previous item references
  const newEdges: Edge[] = [];
  itemsWithSignals.forEach((item: any) => {
    // Special: for Task 1, connect signal-1 -> Task 1
    if (
      (item.name === 'Task 1' || item.label === 'Task 1') &&
      item._signalInjected
    ) {
      newEdges.push({
        id: `signal-1-${getId(item)}`,
        source: 'signal-1',
        target: getId(item),
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#2b9222', strokeWidth: 3 },
      });
      return;
    }
    // For signal-2, connect Task 7 -> signal-2
    if (item.id === 'signal-2') {
      const task7 = itemsWithSignals.find(
        (t: any) => t.name === 'Task 7' || t.label === 'Task 7'
      );
      if (task7) {
        newEdges.push({
          id: `${getId(task7)}-signal-2`,
          source: getId(task7),
          target: 'signal-2',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#2b9222', strokeWidth: 3 },
        });
      }
      return;
    }

    // Default: connect as usual
    const previousIds = getPreviousIds(item);
    previousIds.forEach((previousId: string) => {
      if (previousId) {
        const previousItem = itemsWithSignals.find(
          (t: any) => getId(t) === previousId
        );
        if (previousItem) {
          const isSignalEdge =
            item.signal === true || previousItem.signal === true;
          newEdges.push({
            id: `${previousId}-${getId(item)}`,
            source: previousId,
            target: getId(item),
            type: isSignalEdge ? 'smoothstep' : 'default',
            animated: isSignalEdge,
            style: isSignalEdge
              ? { stroke: '#2b9222', strokeWidth: 3 }
              : undefined,
          });
        }
      }
    });
  });

  console.log(
    'FlowMap: Created nodes:',
    newNodes.length,
    'edges:',
    newEdges.length
  );

  // Apply layout
  const layoutedNodes = createLayout(newNodes, newEdges);

  if (allCustom) {
    nodes.value = layoutedNodes;
    edges.value = newEdges;
  } else {
    nodes.value = [];
    edges.value = [];
  }

  console.log('FlowMap: Applied layout, final nodes:', nodes.value.length);
}
// --- END: TEMPORARY SIGNAL NODE INJECTION ---
//------------------------------------------------------------------------------

/*
// --- BEGIN: ORIGINAL processFlowItems ---
function processFlowItems(items: FlowItem[] | any[]) {
  console.log('FlowMap: Processing flow items:', items);

  if (!items || items.length === 0) {
    console.log('FlowMap: No items data, clearing nodes and edges');
    nodes.value = [];
    edges.value = [];
    return;
  }

  // Debug: log the structure of the first item to understand the API response
  if (items.length > 0) {
    console.log('FlowMap: Sample item structure:', items[0]);
    console.log('FlowMap: Sample item keys:', Object.keys(items[0]));

    // Look for Task 6 in the dataset and log its specific structure
    const task6 = items.find((item) => item.label === 'Task 6');
    if (task6) {
      console.log('FlowMap: Task 6 full object:', task6);
      console.log(
        'FlowMap: Task 6 previousTaskExecutionId type:',
        typeof task6.previousTaskExecutionId
      );
      console.log(
        'FlowMap: Task 6 previousTaskExecutionId value:',
        task6.previousTaskExecutionId
      );
    }
  }

  // Create nodes
  const newNodes: Node[] = items.map((item: any) => {
    // If item.type === 'signal', use signalNode type
    const nodeType = item.type === 'signal' ? 'signalNode' : 'custom';
    return {
      id: getId(item),
      type: nodeType,
      position: { x: 0, y: 0 },
      data: {
        label: getLabel(item),
        uuid: getId(item),
        description: item.description || '',
        is_unique: item.isUnique || item.is_unique || false,
        concurrency: 1,
        isSelected: item.isSelected || false,
        errored: item.errored || false,
        failed: item.failed || false,
        item: item,
      },
    };
  });

  // Create edges based on previous item references
  const newEdges: Edge[] = [];
  items.forEach((item: any) => {
    const previousIds = getPreviousIds(item);

    previousIds.forEach((previousId: string) => {
      if (previousId) {
        const previousItem = items.find((t: any) => getId(t) === previousId);
        if (previousItem) {
          // If either source or target is a signal node, use red animated edge
          const isSignalEdge =
            item.type === 'signal' || previousItem.type === 'signal';
          newEdges.push({
            id: `${previousId}-${getId(item)}`,
            source: previousId,
            target: getId(item),
            type: isSignalEdge ? 'signalEdge' : 'default',
            animated: isSignalEdge,
            style: isSignalEdge
              ? { stroke: '#e53935', strokeWidth: 3 }
              : undefined,
          });
        }
      }
    });
  });

  console.log(
    'FlowMap: Created nodes:',
    newNodes.length,
    'edges:',
    newEdges.length
  );

  // Apply layout
  const layoutedNodes = createLayout(newNodes, newEdges);

  nodes.value = layoutedNodes;
  edges.value = newEdges;

  console.log('FlowMap: Applied layout, final nodes:', nodes.value.length);
}
// --- END: ORIGINAL processFlowItems ---
*/

// Handle node click
function onNodeClick(event: any) {
  const clickedNode = event.node;
  if (clickedNode?.data?.item) {
    emit('item-selected', clickedNode.data.item);
  }
}

// Watch for changes in items
watch(
  () => props.items,
  (newItems) => {
    console.log('FlowMap: Received items data:', newItems);
    console.log('FlowMap: Data length:', newItems?.length || 0);
    processFlowItems(newItems);
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

.error-node {
  background: #d37b7b !important;
}
</style>
