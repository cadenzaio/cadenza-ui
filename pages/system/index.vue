<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title> System </template>
      <div v-show="selectedOption === 'routineMap'">
            <NestedFlowMap
              :nodes="nodes"
              :edges="edges"
              style="height: 80dvh !important"
              @item-selected="handleNodeSelected"
            />
          </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import NestedFlowMap from '@/components/NestedFlowMap.vue';
import { useAppStore } from '@/stores/app';
import { useRouter } from 'vue-router';

const selectedOption = ref('routineMap');
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const appStore = useAppStore();
const router = useRouter();

async function fetchSystemMap() {
  try {
    const res = await fetch('/api/system/system');
    const data = await res.json();

    if (data && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
      nodes.value = data.nodes;
      edges.value = data.edges;
      return;
    }

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
    nodes.value = [];
    edges.value = [];
  }
}

onMounted(() => {
  appStore.setCurrentSection('system');
  fetchSystemMap();
});

function handleNodeSelected(node: any) {
  const clickedNode = node?.node || node;
  const base = appStore.currentSection || 'system';

  if (clickedNode.nodeType === 'task') {
    const taskName = clickedNode.data?.label || clickedNode.data?.id || clickedNode.id;
    if (taskName) {
      // Determine version (prefer explicit data.version, fall back to '1')
      const version = clickedNode.data?.version ?? clickedNode.version ?? '1';

      // Determine service name: prefer data.service_name, otherwise find parent routine -> parent server
      let serviceName = clickedNode.data?.service_name;
      if (!serviceName) {
        const routineNode = nodes.value.find((n: any) => n.id === clickedNode.parentNode);
        const serverNode = routineNode ? nodes.value.find((n: any) => n.id === routineNode.parentNode) : undefined;
        serviceName = serverNode?.data?.label || serverNode?.id || base;
      }

      router.push({
        path: `/system/tasks/${encodeURIComponent(taskName)}`,
        query: { version: String(version), service: String(serviceName) },
      });
    }
  } else if (clickedNode.nodeType === 'signal') {
    const signalName = clickedNode.data?.label || clickedNode.data?.id;
    const serviceName = clickedNode.data?.service_name || base;
    if (signalName) {
      router.push(`/system/signals/${encodeURIComponent(signalName)}?serviceName=${encodeURIComponent(serviceName)}`);
    }
  } else if (clickedNode.nodeType === 'service') {
    const serviceName = clickedNode.data?.label || clickedNode.id;
    if (serviceName) {
      router.push(`/system/services/${encodeURIComponent(serviceName)}`);
    }
  }
}
</script>
