import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function ensureClient() {
  if (!client) {
    client = await initializeClient();
  }
}

// Define types for nodes and edges
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
  const query = `
SELECT
  t.name AS task_name,
  t.description AS task_description,
  t.layer_index,
  t.is_unique,
  t.concurrency,
  t.service_name,
  t.version,
  dtm.predecessor_task_name AS previous_task_execution_name,
  r.name AS routine_name,
  stm.signal_name AS signal_to_task_signal_name,
  tsm.signal_name AS task_to_signal_signal_name
FROM task t
LEFT JOIN directional_task_graph_map dtm
  ON t.name = dtm.task_name
  AND t.version = dtm.task_version
  AND t.service_name = dtm.service_name
LEFT JOIN task_to_routine_map trm
  ON t.name = trm.task_name
  AND t.service_name = trm.service_name
LEFT JOIN routine r
  ON trm.routine_name = r.name
LEFT JOIN signal_to_task_map stm
  ON stm.task_name = t.name
LEFT JOIN task_to_signal_map tsm
  ON tsm.task_name = t.name
WHERE t.service_name = $1 AND t.is_meta = false
  AND (t.deleted IS FALSE OR t.deleted IS NULL);
  `;

  const result = await client!.query(query, [serviceName]);

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const signalNodes: Record<string, string> = {}; // To track signal nodes

  const serviceNode: Node = {
    id: serviceName,
    type: 'custom',
    nodeType: 'service',
    data: { label: serviceName, isParent: true },
  };
  nodes.push(serviceNode);

  const routineMap: Record<string, Node> = {};

  result.rows.forEach((row) => {
    const routineName = row.routine_name || 'UnknownRoutine'; // Assign default value if routine_name is null

    if (!routineMap[routineName]) {
      if (!row.routine_name) {
        console.warn(`Routine name is null for task: ${row.task_name}`); // Log missing routine names
      }

      const routineNode: Node = {
        id: routineName,
        type: 'custom',
        nodeType: 'routine',
        parentNode: serviceName,
        data: { label: routineName, isParent: true },
      };
      routineMap[routineName] = routineNode;
      nodes.push(routineNode);
    }

    const taskNode: Node = {
      id: row.task_name,
      type: 'custom',
      nodeType: 'task',
      parentNode: routineName, // Use the validated routineName
      data: { label: row.task_description || row.task_name },
    };
    nodes.push(taskNode);

    if (row.previous_task_execution_name) {
      edges.push({
        id: `e${row.previous_task_execution_name}-${row.task_name}`,
        source: row.previous_task_execution_name,
        target: row.task_name,
      });
    }

    if (row.signal_to_task_signal_name) {
      let signalNodeId;
      if (!signalNodes[row.signal_to_task_signal_name]) {
        signalNodeId = `${row.task_name}-to-${row.signal_to_task_signal_name}`;
        signalNodes[row.signal_to_task_signal_name] = signalNodeId;
        const signalNode: Node = {
          id: signalNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: serviceName,
          data: { label: row.signal_to_task_signal_name, signal: true },
        };
        nodes.push(signalNode);
      } else {
        signalNodeId = signalNodes[row.signal_to_task_signal_name];
      }

      edges.push({
        id: `e${row.task_name}-${signalNodeId}`,
        source: row.task_name,
        target: signalNodeId,
      });
    }

    if (row.task_to_signal_signal_name) {
      let signalNodeId;
      if (!signalNodes[row.task_to_signal_signal_name]) {
        signalNodeId = `${row.task_name}-from-${row.task_to_signal_signal_name}`;
        signalNodes[row.task_to_signal_signal_name] = signalNodeId;
        const signalNode: Node = {
          id: signalNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: serviceName,
          data: { label: row.task_to_signal_signal_name, signal: true },
        };
        nodes.push(signalNode);
      } else {
        signalNodeId = signalNodes[row.task_to_signal_signal_name];
      }

      edges.push({
        id: `e${signalNodeId}-${row.task_name}`,
        source: signalNodeId,
        target: row.task_name,
      });
    }
  });

  return { nodes, edges };
}

export default defineEventHandler(async (event) => {
  await ensureClient();

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
