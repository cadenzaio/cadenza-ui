import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

// Get a single TaskExecution by ID
async function getSingleTaskExecution(id: string) {
  if (!client) {
    client = await initializeClient();
  }

  const query = `
    SELECT
        te.uuid,
        te.routine_execution_id,
        te.execution_trace_id,
        te.task_name,
        te.task_version,
        te.service_name,
        te.context,
        te.meta_context,
        te.result_context,
        te.meta_result_context,
        te.is_running,
        te.is_complete,
        te.errored,
        te.failed,
        te.progress,
        te.created AS scheduled,
        te.started,
        te.ended,
        r.description AS routine_name,
        t.name,
        t.description,
        t.is_unique,
        t.function_string
    FROM task_execution te
    LEFT JOIN routine_execution re ON te.routine_execution_id = re.uuid
    LEFT JOIN routine r ON re.name = r.name AND re.service_name = r.service_name
    LEFT JOIN task t ON te.task_name = t.name AND te.service_name = t.service_name
    WHERE te.uuid = $1 AND te.is_meta = false
  `;

  const result = await client.query(query, [id]);

  if (result.rows.length === 0) {
    throw new Error(`TaskExecution with ID ${id} not found`);
  }

  const row = result.rows[0];

  return {
    uuid: row.uuid,
    id: row.uuid,
    type: 'task',
    routineExecutionId: row.routine_execution_id,
    execution_trace_id: row.execution_trace_id,
    executionTraceId: row.execution_trace_id,
    taskId: row.task_name,
    taskVersion: row.task_version,
    isRunning: row.is_running,
    isComplete: row.is_complete,
    errored: row.errored,
    failed: row.failed,
    progress: row.progress,
    scheduled: row.scheduled,
    started: formatDate(row.started),
    ended: formatDate(row.ended),
    duration: getDuration(row.started, row.ended),
    inputContext: row.context,
    outputContext: row.result_context,
    name: row.name,
    description: row.description,
    isUnique: row.is_unique,
    functionString: row.function_string,
    serviceName: row.service_name,
    routineName: row.routine_name,
  };
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const id = query.id as string;

      if (!id) {
        throw new Error('Task ID is required');
      }

      return await getSingleTaskExecution(id);
    } catch (error) {
      console.error('Error fetching TaskExecution:', error);
      throw error;
    }
  }
});