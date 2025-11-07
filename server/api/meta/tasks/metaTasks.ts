import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all TaskExecutions without pagination
async function getTaskExecution(
  page: number = 1,
  limit: number = 50
) {
  if (!client) {
    client = await initializeClient();
  }

  const offset = (page - 1) * limit;

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
        t.function_string,
        te.is_meta
    FROM task_execution te
    LEFT JOIN routine_execution re ON te.routine_execution_id = re.uuid
    LEFT JOIN routine r ON re.name = r.name
    LEFT JOIN context ctx ON te.context_id = ctx.uuid
    LEFT JOIN context ctx2 ON te.result_context_id = ctx2.uuid
    LEFT JOIN task t ON te.task_name = t.name
    LEFT JOIN service s ON re.service_name = s.name
    WHERE te.is_meta = true
    ORDER BY te.created DESC
    LIMIT $1 OFFSET $2
    `;

  const params = [limit, offset];
  const result = await client.query(query, params);

  // Map the results to match the expected frontend format
  const mappedRows = result.rows.map((row) => ({
    uuid: row.uuid,
    id: row.uuid,
    type: 'task',
    meta: row.is_meta,
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
    previousTaskExecutionIds: row.previous_task_execution_ids,
    previousTaskNames: row.previous_task_names,
    serviceDbName: row.service_name,
    routineName: row.routine_name,
    contextId: row.context_id,
    resultContextId: row.result_context_id,
    inputContext: row.input_context,
    outputContext: row.output_context,
    name: row.name,
    description: row.description,
    isUnique: row.is_unique,
    functionString: row.function_string,
    serviceName: row.service + '@' + row.address + ':' + row.port,
    service: row.service + '@' + row.address + ':' + row.port,
    layerIndex: row.layer_index,
    previousTaskName: row.previous_task_name,
    processingGraph: row.service,
    referer: row.errored ? 'Errored' : null,
    status: row.is_complete
      ? 'check'
      : row.is_running
      ? 'play_arrow'
      : row.errored
      ? 'close'
      : 'schedule',
  }));

  return {
    tasks: mappedRows,
    total: mappedRows.length,
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
      return await getTaskExecution();
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  }
});
