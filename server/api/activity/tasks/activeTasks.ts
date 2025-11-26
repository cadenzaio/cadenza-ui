import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all TaskExecutions with pagination support
async function getTaskExecution(
  name?: string,
  page: number = 1,
  limit: number = 100
) {
  if (!client) {
    client = await initializeClient();
  }

  const offset = (page - 1) * limit;

  const whereClause = name
    ? "WHERE te.is_meta = false AND te.task_name = $1"
    : 'WHERE te.is_meta = false';

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
    LEFT JOIN service s ON re.service_name = s.name
    ${whereClause}
    ORDER BY te.created DESC
    LIMIT $${name ? '2' : '1'} OFFSET $${name ? '3' : '2'}
    `;
  const params = name ? [name, limit, offset] : [limit, offset];
  const result = await client.query(query, params);
  console.log('activeTasks query params:', { name, page, limit, offset });
  console.log('activeTasks result rows:', result.rows.length);

  // Map the results to match the expected frontend format
  const mappedRows = result.rows.map((row) => ({
    uuid: row.uuid,
    id: row.uuid,
    type: 'task',
    routineExecutionId: row.routine_execution_id,
    taskId: row.task_name,
    isRunning: row.is_running,
    isComplete: row.is_complete,
    errored: row.errored,
    failed: row.failed,
    progress: parseFloat((row.progress * 100).toFixed(2)) + '%',
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
      const query = getQuery(event);
      const name = query.name as string | undefined;
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;

      return await getTaskExecution(name, page, limit);
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  }
});
