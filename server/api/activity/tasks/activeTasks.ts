import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';
import { getQuery } from 'h3';

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
      re.service_instance_id,
      r.description AS routine_name,
      t.name,
      t.description,
      t.is_unique,
      t.function_string
    FROM task_execution te
    LEFT JOIN routine_execution re ON te.routine_execution_id = re.uuid
    LEFT JOIN routine r ON re.name = r.name AND re.service_name = r.service_name
    LEFT JOIN task t ON te.task_name = t.name AND te.service_name = t.service_name
    ${whereClause}
    ORDER BY te.created DESC
    LIMIT $${name ? '2' : '1'} OFFSET $${name ? '3' : '2'}
    `;
  const params = name ? [name, limit, offset] : [limit, offset];
  const result = await client.query(query, params);
  

  // Map the results to match the expected frontend format
  const mappedRows = result.rows.map((row) => {
    const progressVal = typeof row.progress === 'number' ? Math.round(row.progress * 100) : 0;
    return {
      uuid: row.uuid,
      id: row.uuid,
      type: 'task',
      routineExecutionId: row.routine_execution_id,
      taskId: row.task_name,
      taskVersion: row.task_version,
      isRunning: row.is_running,
      isComplete: row.is_complete,
      errored: row.errored,
      failed: row.failed,
      progress: progressVal,
      scheduled: row.scheduled,
      started: formatDate(row.started),
      ended: formatDate(row.ended),
      duration: getDuration(row.started, row.ended),
      serviceDbName: row.service_name,
      routineName: row.routine_name,
      inputContext: row.context,
      outputContext: row.result_context,
      name: row.name,
      description: row.description,
      isUnique: row.is_unique,
      functionString: row.function_string,
      serviceName: row.service_name,
      layerIndex: row.layer_index,
      referer: row.errored ? 'Errored' : null,
      status: row.is_complete
        ? 'check'
        : row.is_running
        ? 'play_arrow'
        : row.errored
        ? 'close'
        : 'schedule',
    };
  });

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
