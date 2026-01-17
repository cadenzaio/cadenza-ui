import { supabaseAdmin } from '~/utils/supabase';

type Node = {
  id: string;
  type: string;
  nodeType: string;
  parentNode?: string;
  data: Record<string, any>;
};

type Edge = {
  id: string;
  source: string;
  target: string;
  style?: { [key: string]: any };
};

async function generateNodesAndEdges(serviceName: string) {
  const { data: result, error } = await supabaseAdmin.rpc('get_tasks_in_service', {
    service_name_param: serviceName
  });

  if (error) {
    console.error('Error executing query:', error);
    throw error;
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const signalNodes: Record<string, string> = {};

  const serviceNode: Node = {
    id: serviceName,
    type: 'custom',
    nodeType: 'service',
    data: { label: serviceName, isParent: true },
  };
  nodes.push(serviceNode);

  const routineMap: Record<string, Node> = {};
  const taskMap: Record<string, any> = {};

  // First pass: create all task nodes and track tasks
  interface TaskRow {
    task_name: string;
    routine_name?: string;
    task_description?: string;
    service_name: string;
    version: string;
    previous_task_execution_name?: string;
    signals?: {
      observed?: string[];
      emits?: string[];
    };
  }

  result.forEach((row: TaskRow) => {
    if (!taskMap[row.task_name]) {
      taskMap[row.task_name] = row;
    }
  });

  // Process each task
  interface RoutineNodeData {
    label: string;
    isParent: boolean;
  }

  interface TaskNodeData {
    label: string;
    id: string;
    service_name: string;
    version: string;
  }

  interface SignalNodeData {
    label: string;
    signal: boolean;
  }

  result.forEach((row: TaskRow) => {
    const routineName: string = row.routine_name || 'UnknownRoutine';

    if (!routineMap[routineName]) {
      if (!row.routine_name) {
        console.warn(`Routine name is null for task: ${row.task_name}`);
      }

      const routineNode: Node = {
        id: routineName,
        type: 'custom',
        nodeType: 'routine',
        parentNode: serviceName,
        data: { label: routineName, isParent: true } as RoutineNodeData,
      };
      routineMap[routineName] = routineNode;
      nodes.push(routineNode);
    }

    const taskNode: Node = {
      id: row.task_name,
      type: 'custom',
      nodeType: 'task',
      parentNode: routineName,
      data: {
        label: row.task_description || row.task_name,
        id: row.task_name,
        service_name: row.service_name,
        version: row.version,
      } as TaskNodeData,
    };
    nodes.push(taskNode);

    if (row.previous_task_execution_name) {
      edges.push({
        id: `e${row.previous_task_execution_name}-${row.task_name}`,
        source: row.previous_task_execution_name,
        target: row.task_name,
      });
    }

    // Process signals from the signals JSON field
    const signals: { observed?: string[]; emits?: string[] } = row.signals || {};
    const observedSignals: string[] = (signals.observed || []).filter((s: string) => !s.startsWith('meta.'));
    const emittedSignals: string[] = (signals.emits || []).filter((s: string) => !s.startsWith('meta.'));

    // Process observed signals (signal -> task)
    observedSignals.forEach((signalName: string) => {
      let signalNodeId: string;
      if (!signalNodes[signalName]) {
        signalNodeId = `signal-${signalName}`;
        signalNodes[signalName] = signalNodeId;
        const signalNode: Node = {
          id: signalNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: serviceName,
          data: { label: signalName, signal: true } as SignalNodeData,
        };
        nodes.push(signalNode);
      } else {
        signalNodeId = signalNodes[signalName];
      }

      edges.push({
        id: `e${signalNodeId}-${row.task_name}`,
        source: signalNodeId,
        target: row.task_name,
      });
    });

    // Process emitted signals (task -> signal)
    emittedSignals.forEach((signalName: string) => {
      let signalNodeId: string;
      if (!signalNodes[signalName]) {
        signalNodeId = `signal-${signalName}`;
        signalNodes[signalName] = signalNodeId;
        const signalNode: Node = {
          id: signalNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: serviceName,
          data: { label: signalName, signal: true } as SignalNodeData,
        };
        nodes.push(signalNode);
      } else {
        signalNodeId = signalNodes[signalName];
      }

      edges.push({
        id: `e${row.task_name}-${signalNodeId}`,
        source: row.task_name,
        target: signalNodeId,
      });
    });
  });

  return { nodes, edges };
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const serviceName = (query.serviceName as string) || (query.service as string);

  if (!serviceName) {
    throw new Error('Missing required query parameter: serviceName');
  }

  if (event.node.req.method === 'GET') {
    try {
      return await generateNodesAndEdges(serviceName);
    } catch (error) {
      console.error('Error generating nodes and edges:', error);
      throw error;
    }
  }
});
