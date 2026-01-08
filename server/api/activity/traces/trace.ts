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
      et.context AS trace_context,
      et.meta_context AS trace_meta_context,
      et.created AS trace_created,
      et.issued_at AS issued_at,
      et.service_name,
      re.name AS routine_name,
      re.uuid AS routine_uuid,
      te.task_name,
      te.uuid AS task_uuid,
      te.created AS task_created,
      te.started AS task_started,
      te.ended AS task_ended,
      te.errored AS task_errored,
      te.failed AS task_failed,
      te.is_complete AS task_is_complete,
      te.progress AS task_progress,
      tem.previous_task_execution_id,
      se_emit.uuid AS signal_emission_uuid,
      se_emit.signal_name AS signal_emission_name,
      se_emit.emitted_at AS signal_emitted_at,
      se_consume.uuid AS signal_consumption_uuid,
      se_consume.signal_name AS signal_consumption_name,
      se_consume.emitted_at AS signal_consumed_at
    FROM execution_trace et
    LEFT JOIN routine_execution re
      ON et.uuid = re.execution_trace_id
    LEFT JOIN task_execution te
      ON re.uuid = te.routine_execution_id
    LEFT JOIN task_execution_map tem
      ON te.uuid = tem.task_execution_id
    LEFT JOIN signal_emission se_emit
      ON te.uuid = se_emit.task_execution_id AND se_emit.is_meta = false
    LEFT JOIN signal_emission se_consume
      ON te.signal_emission_id = se_consume.uuid AND se_consume.is_meta = false
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
        errored: row.task_errored || false,
        failed: row.task_failed || false,
        isComplete: row.task_is_complete ?? true,
        progress: row.task_progress ?? 0,
        data: {
          label: row.task_name || row.task_uuid,
          created: row.task_created ? new Date(row.task_created).toISOString() : null,
          started: row.task_started ? new Date(row.task_started).toISOString() : null,
          ended: row.task_ended ? new Date(row.task_ended).toISOString() : null,
          type: 'task',
        },
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
      const key = row.signal_emission_name;
      if (!signalNodes[key]) {
        signalEmissionNodeId = `${row.task_uuid}-emission-${row.signal_emission_name}`;
        signalNodes[key] = signalEmissionNodeId;
        const startTs = row.signal_emitted_at
          ? new Date(row.signal_emitted_at).getTime()
          : row.signal_consumed_at
          ? new Date(row.signal_consumed_at).getTime()
          : null;
        const startedIso = startTs ? new Date(startTs).toISOString() : null;
        const endedIso = startTs ? new Date(startTs + 500).toISOString() : null;
        const signalEmissionNode = {
          id: signalEmissionNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: row.trace_uuid,
          data: {
            label: row.signal_emission_name,
            signal: true,
            uuid: row.signal_emission_uuid || null,
            created: row.signal_emitted_at ? new Date(row.signal_emitted_at).toISOString() : null,
            started: startedIso,
            ended: endedIso,
            type: 'signal',
          },
        };
        nodes.push(signalEmissionNode);
      } else {
        signalEmissionNodeId = signalNodes[key];
      }

      edges.push({
        id: `e${row.task_uuid}-${signalEmissionNodeId}`,
        source: row.task_uuid,
        target: signalEmissionNodeId,
      });

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
      const key = row.signal_consumption_name;
      if (!signalNodes[key]) {
        signalConsumptionNodeId = `${row.task_uuid}-consumption-${row.signal_consumption_name}`;
        signalNodes[key] = signalConsumptionNodeId;
        const startTs = row.signal_consumed_at
          ? new Date(row.signal_consumed_at).getTime()
          : row.signal_emitted_at
          ? new Date(row.signal_emitted_at).getTime()
          : null;
        const startedIso = startTs ? new Date(startTs).toISOString() : null;
        const endedIso = startTs ? new Date(startTs + 500).toISOString() : null;
        const signalConsumptionNode = {
          id: signalConsumptionNodeId,
          type: 'custom',
          nodeType: 'signal',
          parentNode: row.trace_uuid,
          data: {
            label: row.signal_consumption_name,
            signal: true,
            uuid: row.signal_consumption_uuid || null,
            created: row.signal_consumed_at ? new Date(row.signal_consumed_at).toISOString() : null,
            started: startedIso,
            ended: endedIso,
            type: 'signal',
          },
        };
        nodes.push(signalConsumptionNode);
      } else {
        signalConsumptionNodeId = signalNodes[key];
      }

      edges.push({
        id: `e${signalConsumptionNodeId}-${row.task_uuid}`,
        source: signalConsumptionNodeId,
        target: row.task_uuid,
      });

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

  const rawTraceContext = res.rows[0].trace_context ?? null;
  let parsedTraceContext: any = null;
  if (rawTraceContext) {
    try {
      parsedTraceContext = typeof rawTraceContext === 'string' ? JSON.parse(rawTraceContext) : rawTraceContext;
    } catch (e) {
      parsedTraceContext = rawTraceContext;
    }
  }

  const traceCreatedIso = res.rows[0].trace_created ? new Date(res.rows[0].trace_created).toISOString() : null;
  const serviceName = res.rows[0].service_name ?? null;
  const issuedFromDb = res.rows[0].issued_at ? new Date(res.rows[0].issued_at).toISOString() : null;
  const issuedVal = issuedFromDb ?? parsedTraceContext?.issued ?? parsedTraceContext?.issued_at ?? null;

  const traceContext = {
    ...(parsedTraceContext && typeof parsedTraceContext === 'object' ? parsedTraceContext : {}),
    created: traceCreatedIso,
    issued: issuedVal,
    service_name: serviceName,
  };

  const timelineItems = nodes
    .map((n: any) => {
      const d = n.data || {};
      const common = {
        label: d.label || n.id,
        nodeType: n.nodeType || d.nodeType || 'task',
        description: d.description || d.label || '',
        id: n.id,
        uuid: d.uuid || n.id,
        parentNode: n.parentNode || d.parentNode || null,
        created: d.created || n.created || null,
        started: d.started || n.started || n.created || null,
        ended: d.ended || n.ended || null,
        errored: n.errored ?? d.errored ?? false,
        failed: n.failed ?? d.failed ?? false,
        isComplete: n.isComplete ?? d.isComplete ?? false,
        progress: n.progress ?? d.progress ?? 0,
        layer_index: n.layer_index ?? d.layer_index ?? 0,
        raw: d,
      };

      return {
        ...common,
        timelineType:
          n.nodeType === 'service' || n.nodeType === 'routine'
            ? 'heading'
            : 'body',
        ...d,
      };
    })
    .filter((m: any) => {
      const t = (m.nodeType || '').toString().toLowerCase();
      return t === 'task' || t === 'signal';
    })
    .sort((a: any, b: any) => {
      const aTime = a.started ? new Date(a.started).getTime() : 0;
      const bTime = b.started ? new Date(b.started).getTime() : 0;
      return aTime - bTime;
    });

  const rangedTimelineItems = timelineItems.map((it: any) => ({
    label: it.label,
    uuid: it.uuid || it.id,
    name: it.label,
    started: it.started || it.created || null,
    created: it.created || null,
    ended: it.ended || null,
    progress: it.progress || 0,
    errored: it.errored || false,
    failed: it.failed || false,
    isComplete: it.isComplete || false,
    layer_index: it.layer_index || 0,
    description: it.description || it.raw?.description || null,
    signal: it.raw?.signal || it.signal || false,
    type: it.raw?.type || it.type || null,
  }));

  return { nodes, edges, context: traceContext, timelineItems, rangedTimelineItems };
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