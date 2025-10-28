import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { defineEventHandler, getQuery } from 'h3';

type Node = {
  id: string;
  type: string;
  nodeType: string;
  parentNode?: string;
  data: Record<string, any>;
  position: { x: number; y: number };
};

type Edge = {
  id: string;
  source: string;
  target: string;
};

let client: pg.Client | null = null;

// Generate nodes and edges for NestedFlowMap
async function generateNodesAndEdges(traceUuid: string) {
  const query = `
    SELECT 
      et.uuid AS trace_uuid,
      et.service_name,
      re.name AS routine_name,
      re.uuid AS routine_uuid,
      te.task_name,
      te.uuid AS task_uuid,
      tem.previous_task_execution_id
    FROM execution_trace et
    LEFT JOIN routine_execution re
      ON et.uuid = re.execution_trace_id
    LEFT JOIN task_execution te
      ON re.uuid = te.routine_execution_id
    LEFT JOIN task_execution_map tem
      ON te.uuid = tem.task_execution_id
    WHERE et.uuid = $1;
  `;

  const params = [traceUuid];
  const res = await client!.query(query, params);

  if (res.rows.length === 0) {
    throw new Error(`No trace found with UUID: ${traceUuid}`);
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Update nodes to include parentNode for services and routines
  const serviceNode = {
    id: res.rows[0].trace_uuid,
    type: 'custom',
    nodeType: 'service',
    data: { label: res.rows[0].service_name || res.rows[0].trace_uuid, isParent: true },
    position: { x: 0, y: 0 },
  };
  nodes.push(serviceNode);

  const routineMap: Record<string, Node> = {};

  let yOffset = 0;
  res.rows.forEach((row) => {
    if (!routineMap[row.routine_uuid]) {
      const routineNode = {
        id: row.routine_uuid,
        type: 'custom',
        nodeType: 'routine',
        parentNode: row.trace_uuid, // Set parentNode to the service node
        data: { label: row.routine_name || row.routine_uuid, isParent: true },
        position: { x: 100, y: yOffset },
      };
      routineMap[row.routine_uuid] = routineNode;
      nodes.push(routineNode);
      yOffset += 150; // Increment yOffset for the next node
    }

    if (row.task_uuid) {
      const taskNode = {
        id: row.task_uuid,
        type: 'custom',
        nodeType: 'task',
        parentNode: row.routine_uuid, // Set parentNode to the routine node
        data: { label: row.task_name || row.task_uuid },
        position: { x: 300, y: yOffset },
      };
      nodes.push(taskNode);
      yOffset += 100; // Increment yOffset for the next node

      if (row.previous_task_execution_id) {
        edges.push({
          id: `e${row.previous_task_execution_id}-${row.task_uuid}`,
          source: row.previous_task_execution_id,
          target: row.task_uuid,
        });
      }
    }
  });

  // Log edges for debugging
  console.log('[generateNodesAndEdges] Generated edges:', edges);

  return { nodes, edges };
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const traceUuid = query.uuid as string;

      if (!traceUuid) {
        throw new Error('traceUuid is required');
      }

      return await generateNodesAndEdges(traceUuid);
    } catch (error) {
      console.error('Error generating nodes and edges:', error);
      throw error;
    }
  }
});