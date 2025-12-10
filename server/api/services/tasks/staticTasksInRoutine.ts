import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

interface RoutineTask {
  uuid: string;
  name: string;
  label: string;
  layer_index: number;
  previousTaskExecutionName: string | null;
  description: string;
  is_unique: boolean;
  concurrency: number;
  signalToTaskSignalName: string | null;
  taskToSignalSignalName: string | null;
}

interface Node {
  uuid: string;
  type: 'task' | 'signal';
  name: string;
  label: string;
  layer_index?: number | null;
  metadata?: Record<string, any>;
  description?: string | null;
  is_unique?: boolean;
  concurrency?: number;
  previousTaskExecutionName?: string | null;
  relation?: 'emitted_by' | 'consumed_by' | string;
  task?: string;
  service_name?: string | null;
  [key: string]: any;
}

async function getSignalsEmittedByTask(taskName: string) {
  const q = `
    SELECT DISTINCT signal_name, service_name
    FROM task_to_signal_map
    WHERE task_name = $1
  `;
  const res = await client!.query(q, [taskName]);
  return res.rows;
}

async function getSignalsConsumedByTask(taskName: string) {
  const q = `
    SELECT DISTINCT signal_name, signal_service_name AS service_name
    FROM signal_to_task_map
    WHERE task_name = $1
  `;
  const res = await client!.query(q, [taskName]);
  return res.rows;
}

async function getRoutineMap(routineName: string): Promise<Node[]> {
  const query = `
SELECT
    ttrm.routine_name,
    ttrm.task_name AS name,
    t.name,
    t.service_name,
    t.version,
    t.layer_index,
    t.description,
    t.is_unique,
    t.concurrency,
    dtm.task_name,
    dtm.predecessor_task_name AS previous_task_execution_name
FROM task_to_routine_map ttrm
LEFT OUTER JOIN task t ON ttrm.task_name = t.name
LEFT OUTER JOIN directional_task_graph_map dtm ON ttrm.task_name = dtm.task_name
WHERE routine_name = $1;
  `;

  const result = await client!.query(query, [routineName]);
  const tasks = result.rows;

  const nodes: Node[] = [];

  const taskNames: string[] = tasks.map((t: any) => t.name).filter(Boolean);
  if (taskNames.length === 0) return nodes;

  const emitQ = `
    SELECT DISTINCT task_name, signal_name, service_name
    FROM task_to_signal_map
    WHERE task_name = ANY($1)
  `;
  const emitRes = await client!.query(emitQ, [taskNames]);

  const emittersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};
  (emitRes.rows || []).forEach((r: any) => {
    if (!emittersMap[r.signal_name]) emittersMap[r.signal_name] = [];
    emittersMap[r.signal_name].push({ task_name: r.task_name, service_name: r.service_name });
  });

  const consQ = `
    SELECT DISTINCT task_name, signal_name, signal_service_name AS service_name
    FROM signal_to_task_map
    WHERE task_name = ANY($1)
  `;
  const consRes = await client!.query(consQ, [taskNames]);

  const consumersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};
  (consRes.rows || []).forEach((r: any) => {
    if (!consumersMap[r.signal_name]) consumersMap[r.signal_name] = [];
    consumersMap[r.signal_name].push({ task_name: r.task_name, service_name: r.service_name });
  });

  const consumedSignals = Object.keys(consumersMap);
  if (consumedSignals.length > 0) {
    const externalEmitQ = `
      SELECT DISTINCT task_name, signal_name, service_name
      FROM task_to_signal_map
      WHERE signal_name = ANY($1)
    `;
    const externalEmitRes = await client!.query(externalEmitQ, [consumedSignals]);
    (externalEmitRes.rows || []).forEach((r: any) => {
      if (!emittersMap[r.signal_name]) emittersMap[r.signal_name] = [];
      if (!emittersMap[r.signal_name].some((e) => e.task_name === r.task_name)) {
        emittersMap[r.signal_name].push({ task_name: r.task_name, service_name: r.service_name });
      }
    });
  }

  tasks.forEach((task: any) => {
    nodes.push({
      uuid: task.name,
      type: 'task',
      name: task.name,
      label: task.name,
      service_name: task.service_name ?? null,
      version: task.version ?? null,
      layer_index: task.layer_index ?? null,
      description: task.description,
      is_unique: task.is_unique,
      concurrency: task.concurrency ?? undefined,
      previousTaskExecutionName: task.previous_task_execution_name ?? null,
    });
  });

  const allSignals = Array.from(new Set([...Object.keys(emittersMap), ...Object.keys(consumersMap)]));
  const pushedSignals = new Set<string>();
  allSignals.forEach((sig) => {
    if (pushedSignals.has(sig)) return;
    pushedSignals.add(sig);

    const emitters = emittersMap[sig] || [];
    const consumers = consumersMap[sig] || [];
    const prev = emitters.length > 0 ? emitters[0].task_name : null;
    const serviceName = emitters.length > 0 ? emitters[0].service_name ?? null : (consumers.length > 0 ? consumers[0].service_name ?? null : null);

    nodes.push({
      uuid: `signal::${sig}`,
      type: 'signal',
      name: sig,
      label: sig,
      layer_index: null,
      relation: emitters.length > 0 ? 'emitted_by' : 'consumed_by',
      previousTaskExecutionName: prev,
      service_name: serviceName,
    });

    consumers.forEach((c) => {
      nodes.push({
        uuid: c.task_name,
        type: 'task',
        name: c.task_name,
        label: c.task_name,
        layer_index: null,
        description: null,
        is_unique: false,
        concurrency: undefined,
        previousTaskExecutionName: sig,
        service_name: c.service_name ?? null,
        version: null,
      });
    });
  });

  return nodes;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method, url } = event.node.req;
  const routineName = url?.split('=')[1];

  if (method === 'GET') {
    try {
      return await getRoutineMap(routineName ?? '');
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
