<template>
    <div class="map-container q-ma-md" >
      <div v-if="loading" class="text-center q-pa-md">Loading server map...</div>
      <div v-else-if="nodes.length === 0" class="text-center q-pa-md">No active servers found</div>
      <VueFlow v-else :nodes="nodes" :edges="edges" @node-click="onNodeClick" :max-zoom="1.5" fit-view-on-init contenteditable="false" :nodes-draggable="false" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Node, Edge, Position } from '@vue-flow/core';
import { VueFlow } from '@vue-flow/core';
import dagre from 'dagre';

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
const loading = ref(false);

// Function to apply dagre layout with increased spacing
function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    ranksep: 200,
    nodesep: 5,
    edgesep: 1,
    align: 'DL',
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the dagre graph
  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.width || 5, height: node.height || 30 });
  });

  // Add edges to the dagre graph
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  // Update node positions
  return nodes.map((node) => {
    const nodeWithPos = g.node(node.id);
    return {
      ...node,
      position: { x: nodeWithPos.x, y: nodeWithPos.y },
    };
  });
}

onMounted(async () => {
  loading.value = true;

  try {
    const serverMap = await $fetch('/api/activity/serverMap');
    console.log('Server map data:', serverMap);

    if (serverMap && serverMap.length > 0) {
      // Create nodes - only for active servers
      const activeServers = serverMap.filter(server => server.is_active);
      console.log('Active servers:', activeServers);

      // Get unique servers to avoid duplicates
      const uniqueServers = new Map();
      activeServers.forEach((server) => {
        uniqueServers.set(server.server_id, server);
      });

      console.log('Unique servers map:', uniqueServers);

      uniqueServers.forEach((server, serverId) => {
        nodes.value.push({
          id: serverId,
          position: { x: 0, y: 0 },
          sourcePosition: 'right' as Position,
          targetPosition: 'left' as Position,
          data: { label: server.processing_graph },
          type: 'default',
          style: {
            background: '#7abfd2',
            color: 'white',
            border: '1px solid #333',
            borderRadius: '4px',
            padding: '5px',
            width: '100px',
            height: '25px'
          }
        });
      });

      console.log('Nodes created:', nodes.value);

      // Create edges based on client_id
      activeServers.forEach((server) => {
        if (server.client_id && uniqueServers.has(server.client_id)) {
          edges.value.push({
            id: `e${server.server_id}-${server.client_id}`,
            source: server.client_id,
            target: server.server_id,
            animated: false,
            style: { stroke: '#333' }
          });
        }
      });

      console.log('Edges created:', edges.value);

      // Apply dagre layout
      if (nodes.value.length > 0) {
        nodes.value = layoutGraph(nodes.value, edges.value);
        console.log('Nodes after layout:', nodes.value);
      }
    }
  } catch (error) {
    console.error('Error fetching server map:', error);
  } finally {
    loading.value = false;
  }
});

// Add click event handler
const emit = defineEmits(['nodeSelected']);
function onNodeClick({ event, node }: { event: any, node: Node }) {
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
