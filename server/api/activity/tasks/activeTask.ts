import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';

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
        te.task_name,
        te.is_running,
        te.is_complete,
        te.errored,
        te.failed,
        te.progress,
        te.created AS scheduled,
        te.started,
        te.ended,
        re.service_name,
        r.description AS routine_name,
        ctx.uuid AS context_id,
        ctx2.uuid AS result_context_id,
        ctx.context AS input_context,
        ctx2.context AS output_context,
        t.name,
        t.description,
        t.is_unique,
        t.function_string
    FROM task_execution te
    LEFT JOIN routine_execution re ON te.routine_execution_id = re.uuid
    LEFT JOIN routine r ON re.name = r.name
    LEFT JOIN context ctx ON te.context_id = ctx.uuid
    LEFT JOIN context ctx2 ON te.result_context_id = ctx2.uuid
    LEFT JOIN task t ON te.task_name = t.name
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
    taskId: row.task_name,
    isRunning: row.is_running,
    isComplete: row.is_complete,
    errored: row.errored,
    failed: row.failed,
    progress: row.progress,
    scheduled: row.scheduled,
    started: formatDate(row.started),
    ended: formatDate(row.ended),
    duration: getDuration(row.started, row.ended),
    contextId: row.context_id,
    resultContextId: row.result_context_id,
    inputContext: row.input_context,
    outputContext: row.output_context,
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