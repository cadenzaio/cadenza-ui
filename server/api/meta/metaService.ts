import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function ensureClient() {
  if (!client) {
    client = await initializeClient();
  }
}

type Node = {
  id: string;
  name?: string;
  type: string;
  nodeType: string;
  parentNode?: string;
  data: Record<string, any>;
  description?: string;
};

type Edge = {
  id: string;
  source: string;
  target: string;
  style?: { [key: string]: any };
};

async function generateNodesAndEdges(serviceName: string, limit: number = 0, offset: number = 0) {
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
  dtm.predecessor_service_name AS previous_task_service_name,
  dtm.predecessor_task_version AS previous_task_version,
  (
    SELECT array_agg(x)
    FROM jsonb_array_elements_text(COALESCE(t.signals->'emits', '[]'::jsonb)) AS x
  ) AS emits,
  (
    SELECT array_agg(x)
    FROM jsonb_array_elements_text(COALESCE(t.signals->'signalsToEmitAfter', '[]'::jsonb)) AS x
  ) AS signals_to_emit_after,
  (
    SELECT array_agg(x)
    FROM jsonb_array_elements_text(COALESCE(t.signals->'signalsToEmitOnFail', '[]'::jsonb)) AS x
  ) AS signals_to_emit_on_fail,
  (
    SELECT array_agg(x)
    FROM jsonb_array_elements_text(COALESCE(t.signals->'observed', '[]'::jsonb)) AS x
  ) AS observed
FROM task t
LEFT JOIN directional_task_graph_map dtm
  ON t.name = dtm.task_name
  AND t.version = dtm.task_version
  AND t.service_name = dtm.service_name
WHERE t.service_name = $1 AND t.is_meta = true
  AND (t.deleted IS FALSE OR t.deleted IS NULL)
  ${limit > 0 ? 'LIMIT $2 OFFSET $3' : ''};
  `;

  const params: any[] = [serviceName];
  if (limit > 0) params.push(limit, offset);

  const result = await client!.query(query, params);

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const signalNodes: Record<string, string> = {};
  const addedTasks = new Set<string>();
  const addedEdges = new Set<string>();


  const taskNames = new Set(result.rows.map((r: any) => r.task_name));

  result.rows.forEach((row) => {
    if (!addedTasks.has(row.task_name)) {
      const taskNode: Node = {
        id: row.task_name,
        name: row.task_name,
        type: 'custom',
        nodeType: 'task',
        data: { label: row.task_name},
        description: row.task_description,
      };
      nodes.push(taskNode);
      addedTasks.add(row.task_name);
    }

    if (row.previous_task_execution_name) {
      if (taskNames.has(row.previous_task_execution_name)) {
        const edgeId = `e${row.previous_task_execution_name}-${row.task_name}`;
        if (!addedEdges.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: row.previous_task_execution_name,
            target: row.task_name,
          });
          addedEdges.add(edgeId);
        }
      }
    }

    const emittedSignals: string[] = [];
    if (Array.isArray(row.emits)) emittedSignals.push(...row.emits.filter(Boolean));
    if (Array.isArray(row.signals_to_emit_after)) emittedSignals.push(...row.signals_to_emit_after.filter(Boolean));
    if (Array.isArray(row.signals_to_emit_on_fail)) emittedSignals.push(...row.signals_to_emit_on_fail.filter(Boolean));

    emittedSignals.forEach((sig) => {
      const signalId = signalNodes[sig] ?? `signal::${sig}`;
      if (!signalNodes[sig]) {
        signalNodes[sig] = signalId;
        nodes.push({ id: signalId, type: 'custom', nodeType: 'signal', data: { label: sig, signal: true } });
      }
      const edgeId = `e${row.task_name}-${signalId}`;
      if (!addedEdges.has(edgeId)) {
        edges.push({ id: edgeId, source: row.task_name, target: signalId });
        addedEdges.add(edgeId);
      }
    });

    if (Array.isArray(row.observed)) {
      row.observed.filter(Boolean).forEach((sig: string) => {
        const signalId = signalNodes[sig] ?? `signal::${sig}`;
        if (!signalNodes[sig]) {
          signalNodes[sig] = signalId;
          nodes.push({ id: signalId, type: 'custom', nodeType: 'signal', data: { label: sig, signal: true } });
        }
        const edgeId = `e${signalId}-${row.task_name}`;
        if (!addedEdges.has(edgeId)) {
          edges.push({ id: edgeId, source: signalId, target: row.task_name });
          addedEdges.add(edgeId);
        }
      });
    }
  });

  return { nodes, edges };
}

export default defineEventHandler(async (event) => {
  await ensureClient();

  const query = getQuery(event);
  const serviceName = (query.serviceName as string) || (query.service as string);
  const page = parseInt((query.page as string) || '1', 10) || 1;
  const pageSize = parseInt((query.pageSize as string) || '500', 10) || 500;
  const offset = (page - 1) * pageSize;

  if (!serviceName) {
    throw new Error('Missing required query parameter: serviceName');
  }

  if (event.node.req.method === 'GET') {
    try {
      const countQuery = `
SELECT COUNT(*)::int AS cnt
FROM task t
WHERE t.service_name = $1 AND t.is_meta = true
  AND (t.deleted IS FALSE OR t.deleted IS NULL);
      `;
      const countResult = await client!.query(countQuery, [serviceName]);
      const totalCount: number = countResult.rows[0]?.cnt ?? 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      const data = await generateNodesAndEdges(serviceName, pageSize, offset);
      
      // Count total nodes and edges for entire service
      const totalEdgesQuery = `
SELECT COUNT(*) as edge_count
FROM directional_task_graph_map dtm
JOIN task t ON dtm.task_name = t.name AND dtm.service_name = t.service_name AND dtm.task_version = t.version
WHERE t.service_name = $1 AND t.is_meta = true
  AND (t.deleted IS FALSE OR t.deleted IS NULL);
      `;
      const edgesResult = await client!.query(totalEdgesQuery, [serviceName]);
      const totalEdgeCount = edgesResult.rows[0]?.edge_count ?? 0;
      
      return { 
        ...data, 
        totalPages, 
        page, 
        pageSize,
        nodeCount: totalCount,
        edgeCount: totalEdgeCount,
      };
    } catch (error) {
      console.error('Error generating nodes and edges:', error);
      throw error;
    }
  }
});
