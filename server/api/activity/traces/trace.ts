import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { defineEventHandler, getQuery } from 'h3';

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
      tem.previous_task_execution_id,
      se.signal_name AS signal_emission_name,
      sc.signal_name AS signal_consumption_name
    FROM execution_trace et
    LEFT JOIN routine_execution re
      ON et.uuid = re.execution_trace_id
    LEFT JOIN task_execution te
      ON re.uuid = te.routine_execution_id
    LEFT JOIN task_execution_map tem
      ON te.uuid = tem.task_execution_id
    LEFT JOIN signal_emission se
      ON te.uuid = se.task_execution_id AND se.is_meta = false
    LEFT JOIN signal_consumption sc
      ON te.uuid = sc.task_execution_id AND sc.is_meta = false
    WHERE et.uuid = $1;
  `;

  const params = [traceUuid];
  const res = await client!.query(query, params);

  if (res.rows.length === 0) {
    throw new Error(`No trace found with UUID: ${traceUuid}`);
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const signalNodes: Record<string, string> = {};

  // Update nodes to include parentNode for services and routines
  const serviceNode = {
    id: res.rows[0].trace_uuid,
    type: 'custom',
    nodeType: 'service',
    data: { label: res.rows[0].service_name || res.rows[0].trace_uuid, isParent: true },    
  };
  nodes.push(serviceNode);

  const routineMap: Record<string, Node> = {};

  res.rows.forEach((row) => {
    if (!routineMap[row.routine_uuid]) {
      const routineNode = {
        id: row.routine_uuid,
        type: 'custom',
        nodeType: 'routine',
        parentNode: row.trace_uuid, 
        data: { label: row.routine_name || row.routine_uuid, isParent: true },        
      };
      routineMap[row.routine_uuid] = routineNode;
      nodes.push(routineNode);
    }

    if (row.task_uuid) {
      const taskNode = {
        id: row.task_uuid,
        type: 'custom',
        nodeType: 'task',
        parentNode: row.routine_uuid, 
        data: { label: row.task_name || row.task_uuid },        
      };
      nodes.push(taskNode);
    
      if (row.previous_task_execution_id) {
        edges.push({
          id: `e${row.previous_task_execution_id}-${row.task_uuid}`,
          source: row.previous_task_execution_id,
          target: row.task_uuid,
        });
      }
    }
    if (row.signal_emission_name) {
      let signalEmissionNodeId;
      if (!signalNodes[row.signal_emission_name]) {
        signalEmissionNodeId = `${row.task_uuid}-emission-${row.signal_emission_name}`;
        signalNodes[row.signal_emission_name] = signalEmissionNodeId;
        const signalEmissionNode = {
          id: signalEmissionNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: row.trace_uuid,
          data: { label: row.signal_emission_name, signal: true }, // Explicitly set signal property
        };
        nodes.push(signalEmissionNode);
      } else {
        signalEmissionNodeId = signalNodes[row.signal_emission_name];
      }

      edges.push({
        id: `e${row.task_uuid}-${signalEmissionNodeId}`,
        source: row.task_uuid,
        target: signalEmissionNodeId,
      });

      // Create edge to parent routine with custom edge type
      if (row.routine_uuid) {
        edges.push({
          id: `e${signalEmissionNodeId}-${row.routine_uuid}`,
          source: row.routine_uuid,
          target: signalEmissionNodeId,
          style: { display: 'none' }
        });
      }
    }

    if (row.signal_consumption_name) {
      let signalConsumptionNodeId;
      if (!signalNodes[row.signal_consumption_name]) {
        signalConsumptionNodeId = `${row.task_uuid}-consumption-${row.signal_consumption_name}`;
        signalNodes[row.signal_consumption_name] = signalConsumptionNodeId;
        const signalConsumptionNode = {
          id: signalConsumptionNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: row.trace_uuid,
          data: { label: row.signal_consumption_name, signal: true }, // Explicitly set signal property
        };
        nodes.push(signalConsumptionNode);
      } else {
        signalConsumptionNodeId = signalNodes[row.signal_consumption_name];
      }

      edges.push({
        id: `e${signalConsumptionNodeId}-${row.task_uuid}`,
        source: signalConsumptionNodeId,
        target: row.task_uuid,
      });

      // Create edge to parent routine with custom edge type
      if (row.routine_uuid) {
        edges.push({
          id: `e${signalConsumptionNodeId}-${row.routine_uuid}`,
          source: signalConsumptionNodeId,
          target: row.routine_uuid,
          style: { display: 'none' }
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