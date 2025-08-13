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

// Get all routines with full mapping
async function getRoutineMap(
  routineId: string,
  selectedTaskId?: string,
  selectionType: string = 'execution'
) {
  // First, get all task executions
  const taskQuery = `
    SELECT
        te.uuid,
        te.routine_execution_id,
        te.task_id,
        te.context_id,
        te.result_context_id,
        te.is_running,
        te.is_complete,
        te.errored,
        te.failed,
        te.progress,
        te.created AS scheduled,
        te.started,
        te.ended,
        t.name,
        t.description,
        t.layer_index,
        t.processing_graph,
        t.is_unique,
        ctx.uuid AS context_uuid,
        ctx2.uuid AS result_context_uuid,
        ctx.context AS input_context,
        ctx2.context AS output_context
    FROM task_execution te
    LEFT JOIN task t ON te.task_id = t.uuid
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
    LEFT JOIN task pt ON pte.task_id = pt.uuid
    WHERE tem.task_execution_id IN (
        SELECT te.uuid
        FROM task_execution te
        WHERE te.routine_execution_id = $1
    );
  `;

  const [taskResult, previousTasksResult] = await Promise.all([
    client!.query(taskQuery, [routineId]),
    client!.query(previousTasksQuery, [routineId]),
  ]);

  // Group previous tasks by task execution ID
  const previousTasksMap = new Map<
    string,
    Array<{
      previousTaskExecutionId: string;
      previousTaskName: string;
    }>
  >();

  previousTasksResult.rows.forEach((row: any) => {
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
  const map = taskResult.rows.map((task: any) => {
    // Generate a split group ID based on the task name
    const taskNameCodeNumber = stringToUnitInterval(task.name || '');

    // Get previous executions for this task
    const previousExecutions = previousTasksMap.get(task.uuid) || [];

    return {
      label: task.name,
      uuid: task.uuid,
      taskId: task.task_id,
      contextId: task.context_uuid,
      resultContextId: task.result_context_uuid,
      isRunning: task.is_running,
      isComplete: task.is_complete,
      errored: task.errored,
      failed: task.failed,
      progress: (task.progress * 100).toFixed(0),
      scheduled: task.scheduled,
      started: task.started,
      ended: task.ended,
      previousExecutions: previousExecutions,
      // Keep legacy fields for backward compatibility
      previousTaskExecutionId:
        previousExecutions.length > 0
          ? previousExecutions[0].previousTaskExecutionId
          : null,
      previous_task_name:
        previousExecutions.length > 0
          ? previousExecutions[0].previousTaskName
          : null,
      name: task.name,
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
          ? task.task_id === selectedTaskId
          : task.uuid === selectedTaskId
        : false,
    };
  });

  // Process splitGroupId mapping
  const splitGroupIndices = new Map<string, number>();
  let index = 0;
  map.forEach((node: any) => {
    if (splitGroupIndices.has(node.splitGroupId.toString())) {
      node.splitGroupId = splitGroupIndices.get(node.splitGroupId.toString());
    } else {
      splitGroupIndices.set(node.splitGroupId.toString(), index);
      node.splitGroupId = index;
      index++;
    }

    const taskNameCodeNumber = stringToUnitInterval(node.name);
    node.splitGroupId += taskNameCodeNumber;
  });

  // Sort by splitGroupId and return
  return map.sort((a: any, b: any) => a.splitGroupId - b.splitGroupId);
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method, url } = event.node.req;
  const urlParams = new URLSearchParams(url?.split('?')[1] || '');
  const routineId = urlParams.get('routineId');
  const selectedTaskId = urlParams.get('selectedTaskId');
  const selectionType = urlParams.get('selectionType') || 'execution';

  if (method === 'GET') {
    try {
      return await getRoutineMap(
        routineId ?? '',
        selectedTaskId || undefined,
        selectionType
      );
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
