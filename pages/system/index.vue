<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> System </template>
      <div v-show="selectedOption === 'routineMap'">
        <NestedFlowMap
          :nodes="nodes"
          :edges="edges"
          style="height: 80dvh !important"
        />
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import NestedFlowMap from '@/components/NestedFlowMap.vue';
import { useAppStore } from '@/stores/app';

const selectedOption = ref('routineMap');
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);

async function fetchSystemMap() {
  try {
    const res = await fetch('/api/system/system');
    const data = await res.json();

    // If the API already returns nodes/edges, use them directly
    if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
      nodes.value = data.nodes;
      edges.value = data.edges;
      return;
    }

    // Fallback: Flatten servers, routines, and tasks into nodes and edges for NestedFlowMap
    const nodeList: any[] = [];
    const edgeList: any[] = [];
    if (data.servers) {
      data.servers.forEach((server: any) => {
        nodeList.push({
          id: server.uuid,
          type: 'custom',
          nodeType: 'service',
          data: { label: server.graph, isParent: true },
          created: server.modified,
          extent: 'parent',
          expandParent: true,
        });
        if (server.routines) {
          server.routines.forEach((routine: any) => {
            nodeList.push({
              id: routine.uuid,
              type: 'custom',
              nodeType: 'routine',
              data: { label: routine.label, isParent: true },
              parentNode: server.uuid,
              created: routine.started,
              started: routine.started,
              ended: routine.ended,
              extent: 'parent',
              expandParent: true,
            });
            if (routine.tasks) {
              routine.tasks.forEach((task: any) => {
                nodeList.push({
                  id: task.uuid,
                  type: 'custom',
                  nodeType: 'task',
                  data: { label: task.label },
                  parentNode: routine.uuid,
                  created: task.created,
                  started: task.started,
                  ended: task.ended,
                  extent: 'parent',
                  expandParent: true,
                  style: { margin: '50px', padding: '10px' },
                });
                // Edges from previousTaskExecutionId
                if (task.previousTaskExecutionId) {
                  edgeList.push({
                    id: `e${task.previousTaskExecutionId}-${task.uuid}`,
                    source: task.previousTaskExecutionId,
                    target: task.uuid,
                  });
                }
              });
            }
          });
        }
      });
    }
    // Add server-to-server edges
    if (data.serverEdges) {
      data.serverEdges.forEach((edge: any, idx: number) => {
        edgeList.push({
          id: `server-edge-${idx}`,
          source: edge.source,
          target: edge.target,
          type: 'server-link',
        });
      });
    }
    nodes.value = nodeList;
    edges.value = edgeList;
  } catch (e) {
    // fallback: clear nodes/edges
    nodes.value = [];
    edges.value = [];
  }
}

onMounted(() => {
  const appStore = useAppStore();
  appStore.setCurrentSection('system');
  fetchSystemMap();
});
</script>
