import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

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
  const { data, error } = await supabaseAdmin.rpc('get_meta_service_graph', {
    service_name: serviceName,
    limit_val: limit,
    offset_val: offset
  });

  if (error) {
    throw error;
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const signalNodes: Record<string, string> = {};
  const addedTasks = new Set<string>();
  const addedEdges = new Set<string>();

  const taskNames = new Set(data.map((r: any) => r.task_name));

  data.forEach((row: any) => {
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
      // Get total count
      const { count: totalCount, error: countError } = await supabaseAdmin
        .from('task')
        .select('*', { count: 'exact', head: true })
        .eq('service_name', serviceName)
        .eq('is_meta', true)
        .or('deleted.is.null,deleted.eq.false');

      if (countError) throw countError;

      const totalPages = Math.ceil((totalCount || 0) / pageSize);

      const data = await generateNodesAndEdges(serviceName, pageSize, offset);

      // Count total edges
      const { count: totalEdgeCount, error: edgesError } = await supabaseAdmin
        .from('directional_task_graph_map')
        .select('*', { count: 'exact', head: true })
        .eq('service_name', serviceName);

      if (edgesError) throw edgesError;

      return {
        ...data,
        totalPages,
        page,
        pageSize,
        nodeCount: totalCount || 0,
        edgeCount: totalEdgeCount || 0,
      };
    } catch (error) {
      console.error('Error generating nodes and edges:', error);
      throw error;
    }
  }
});
