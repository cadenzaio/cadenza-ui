import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Hash functions for splitGroupId calculation
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

function stringToUnitInterval(str: string): number {
  const hash = fnv1aHash(str);
  return hash / 0xffffffff;
}

// Types for task rows and mapped objects
interface TaskRow {
  uuid: string;
  routine_execution_id: string;
  task_name: string;
  context_id: string | null;
  result_context_id: string | null;
  is_running: boolean;
  is_complete: boolean;
  is_scheduled: boolean;
  errored: boolean;
  failed: boolean;
  progress: number;
  scheduled: Date;
  started: Date | null;
  ended: Date | null;
  name: string;
  description: string;
  layer_index: number;
  processing_graph: string | null;
  is_unique: boolean;
  context_uuid: string | null;
  result_context_uuid: string | null;
  input_context: Record<string, unknown>;
  output_context: Record<string, unknown>;
  server_id?: string;
}

interface PreviousTaskRow {
  task_execution_id: string;
  previous_task_execution_id: string;
  prev_uuid: string;
  previous_task_name: string;
}

interface RoutineMapNode {
  label: string;
  uuid: string;
  taskId: string;
  contextId: string | null;
  resultContextId: string | null;
  isRunning: boolean;
  isComplete: boolean;
  errored: boolean;
  failed: boolean;
  progress: string;
  scheduled: Date;
  started: Date | null;
  ended: Date | null;
  previousExecutions: Array<{
    previousTaskExecutionId: string;
    previousTaskName: string;
  }>;
  previousTaskExecutionId: string | null;
  previous_task_name: string | null;
  name: string;
  description: string;
  serverName: string | null;
  isUnique: boolean;
  serverId?: string;
  inputContext: Record<string, unknown>;
  outputContext: Record<string, unknown>;
  layer_index: number;
  splitGroupId: number;
  isSelected: boolean;
}

// Get all routines with full mapping
async function getRoutineMap(
  routineName: string,
  selectedTaskId?: string,
  selectionType: string = 'execution'
) {
  // First, get all task executions
  const taskQuery = `
    SELECT
        te.uuid,
        te.routine_execution_id,
        te.task_name,
        te.context_id,
        te.result_context_id,
        te.is_running,
        te.is_complete,
        te.is_scheduled,
        te.errored,
        te.failed,
        te.progress,
        te.created AS scheduled,
        te.started,
        te.ended,
        re.name AS routine_name,
  t.name,
  t.description,
  t.layer_index,
  NULL AS processing_graph,
        t.is_unique,
        ctx.uuid AS context_uuid,
        ctx2.uuid AS result_context_uuid,
        ctx.context AS input_context,
        ctx2.context AS output_context
    FROM task_execution te
  LEFT JOIN task t ON te.task_name = t.name
    LEFT JOIN routine_execution re ON te.routine_execution_id = re.uuid
    LEFT JOIN context ctx ON te.context_id = ctx.uuid
    LEFT JOIN context ctx2 ON te.result_context_id = ctx2.uuid
    WHERE te.routine_execution_id = $1
    ORDER BY te.started;
  `;

  // Get all previous task execution mappings
  const previousTasksQuery = `
    SELECT
        tem.task_execution_id,
        tem.previous_task_execution_id,
        pte.uuid as prev_uuid,
        pt.name as previous_task_name
    FROM task_execution_map tem
    LEFT JOIN task_execution pte ON tem.previous_task_execution_id = pte.uuid
  LEFT JOIN task pt ON pte.task_name = pt.name
    WHERE tem.task_execution_id IN (
        SELECT te.uuid
        FROM task_execution te
        WHERE te.routine_execution_id = $1
    );
  `;

  const [taskResult, previousTasksResult] = await Promise.all([
    client!.query(taskQuery, [routineName]),
    client!.query(previousTasksQuery, [routineName]),
  ]);

  // Group previous tasks by task execution ID
  const previousTasksMap = new Map<
    string,
    Array<{
      previousTaskExecutionId: string;
      previousTaskName: string;
    }>
  >();

  previousTasksResult.rows.forEach((row: PreviousTaskRow) => {
    if (!previousTasksMap.has(row.task_execution_id)) {
      previousTasksMap.set(row.task_execution_id, []);
    }
    if (row.previous_task_execution_id) {
      previousTasksMap.get(row.task_execution_id)!.push({
        previousTaskExecutionId: row.previous_task_execution_id,
        previousTaskName: row.previous_task_name,
      });
    }
  });

  // Map the raw data to the expected frontend format
  const map: RoutineMapNode[] = taskResult.rows.map((task: TaskRow) => {
    // Generate a split group ID based on the task name
    const taskNameCodeNumber = stringToUnitInterval(task.name || '');

    // Get previous executions for this task
    const previousExecutions = previousTasksMap.get(task.uuid) || [];

    return {
      label: task.name,
      name: task.name,
      uuid: task.uuid,
  taskId: task.uuid,
      contextId: task.context_uuid,
      resultContextId: task.result_context_uuid,
      isRunning: task.is_running,
      is_running: task.is_running,
      isComplete: task.is_complete,
      is_complete: task.is_complete, 
      errored: task.errored,
      failed: task.failed,
      progress: (task.progress * 100).toFixed(0),
      scheduled: task.scheduled,
      is_scheduled: task.is_scheduled,
      started: task.started,
      ended: task.ended,
      previousExecutions: previousExecutions,
      previousTaskExecutionId:
        previousExecutions.length > 0
          ? previousExecutions[0].previousTaskExecutionId
          : null,
      previous_task_name:
        previousExecutions.length > 0
          ? previousExecutions[0].previousTaskName
          : null,
      description: task?.description,
      serverName: task?.processing_graph,
      isUnique: task.is_unique,
      serverId: task.server_id,
      inputContext: task.input_context,
      outputContext: task.output_context,
      layer_index: task.layer_index,
      splitGroupId: taskNameCodeNumber,
      isSelected: selectedTaskId
        ? selectionType === 'definition'
          ? (task as any).task_name === selectedTaskId
          : task.uuid === selectedTaskId
        : false,
    };
  });

  // Process splitGroupId mapping
  const splitGroupIndices = new Map<string, number>();
  let index = 0;
  map.forEach((node) => {
    if (splitGroupIndices.has(node.splitGroupId.toString())) {
      node.splitGroupId = splitGroupIndices.get(node.splitGroupId.toString())!;
    } else {
      splitGroupIndices.set(node.splitGroupId.toString(), index);
      node.splitGroupId = index;
      index++;
    }

    const taskNameCodeNumber = stringToUnitInterval(node.name);
    node.splitGroupId += taskNameCodeNumber;
  });

  // Sort by splitGroupId and return
  const sorted = map.sort((a, b) => a.splitGroupId - b.splitGroupId);

  // --- Signal handling: fetch emissions/consumptions for these task executions
  const taskExecIds = sorted.map((m) => m.uuid).filter(Boolean);
  if (taskExecIds.length === 0) return sorted;

  // Fetch signal emissions for task executions in this routine
  const emitQ = `
    SELECT DISTINCT task_execution_id, signal_name, service_instance_id
    FROM signal_emission
    WHERE task_execution_id = ANY($1) AND is_meta = false
  `;
  const emitRes = await client!.query(emitQ, [taskExecIds]);

  // Build emitters map: signal -> [{ task_execution_id, service_instance_id }]
  const emittersMap: Record<string, Array<{ task_execution_id: string; service_instance_id?: string }>> = {};
  (emitRes.rows || []).forEach((r: any) => {
    if (!emittersMap[r.signal_name]) emittersMap[r.signal_name] = [];
    emittersMap[r.signal_name].push({ task_execution_id: r.task_execution_id, service_instance_id: r.service_instance_id });
  });

  // Fetch signal consumptions for task executions in this routine
  const consQ = `
    SELECT DISTINCT task_execution_id, signal_name, service_instance_id
    FROM signal_consumption
    WHERE task_execution_id = ANY($1) AND is_meta = false
  `;
  const consRes = await client!.query(consQ, [taskExecIds]);

  // Build consumers map: signal -> [{ task_execution_id, service_instance_id }]
  const consumersMap: Record<string, Array<{ task_execution_id: string; service_instance_id?: string }>> = {};
  (consRes.rows || []).forEach((r: any) => {
    if (!consumersMap[r.signal_name]) consumersMap[r.signal_name] = [];
    consumersMap[r.signal_name].push({ task_execution_id: r.task_execution_id, service_instance_id: r.service_instance_id });
  });

  // For any consumed signals, fetch external emitters (outside this routine)
  const consumedSignals = Object.keys(consumersMap);
  if (consumedSignals.length > 0) {
    const externalEmitQ = `
      SELECT DISTINCT task_execution_id, signal_name, service_instance_id
      FROM signal_emission
      WHERE signal_name = ANY($1) AND is_meta = false
    `;
    const externalEmitRes = await client!.query(externalEmitQ, [consumedSignals]);
    (externalEmitRes.rows || []).forEach((r: any) => {
      if (!emittersMap[r.signal_name]) emittersMap[r.signal_name] = [];
      if (!emittersMap[r.signal_name].some((e) => e.task_execution_id === r.task_execution_id)) {
        emittersMap[r.signal_name].push({ task_execution_id: r.task_execution_id, service_instance_id: r.service_instance_id });
      }
    });
  }

  // Append signal nodes and synthetic consumer link nodes so FlowMap can render them.
  const allSignals = Array.from(new Set([...Object.keys(emittersMap), ...Object.keys(consumersMap)]));
  for (const sig of allSignals) {
    const emitters = emittersMap[sig] || [];
    const consumers = consumersMap[sig] || [];

    // Add a signal node (use uuid form 'signal::<name>')
    const signalUuid = `signal::${sig}`;
    // Push as any to avoid TypeScript type mismatch with RoutineMapNode
    (sorted as any).push({
      uuid: signalUuid,
      name: signalUuid,
      label: sig,
      signal: true,
      // representative previous is first emitter (if any)
      previousTaskExecutionId: emitters.length > 0 ? emitters[0].task_execution_id : null,
      serviceInstanceId: emitters.length > 0 ? emitters[0].service_instance_id ?? null : null,
    });

    // For each consumer, add a synthetic linking item that will create an edge from signal -> consumer
    for (const c of consumers) {
      (sorted as any).push({
        uuid: `${c.task_execution_id}::consumes::${sig}`,
        name: c.task_execution_id, // so getId fallback will reference the real execution id
        label: c.task_execution_id,
        previousTaskExecutionId: signalUuid,
        originalTaskExecutionId: c.task_execution_id,
      });
    }
  }

  return sorted;
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method, url } = event.node.req;
  const urlParams = new URLSearchParams(url?.split('?')[1] || '');
  const routineName = urlParams.get('routineName');
  const selectedTaskId = urlParams.get('selectedTaskId');
  const selectionType = urlParams.get('selectionType') || 'execution';

  if (method === 'GET') {
    try {
      return await getRoutineMap(
        routineName ?? '',
        selectedTaskId || undefined,
        selectionType
      );
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
