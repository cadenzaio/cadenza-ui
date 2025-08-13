import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all TaskExecutions with pagination support
async function getTaskExecution(
  id?: string,
  page: number = 1,
  limit: number = 100
) {
  if (!client) {
    client = await initializeClient();
  }

  const offset = (page - 1) * limit;

  const query = `
    SELECT
        te.uuid,
        te.routine_execution_id,
        te.task_id,
        te.is_running,
        te.is_complete,
        te.errored,
        te.failed,
        te.progress,
        te.created AS scheduled,
        te.started,
        te.ended,
        re.server_id,
        re.description AS routine_name,
        ctx.uuid AS context_id,
        ctx2.uuid AS result_context_id,
        ctx.context AS input_context,
        ctx2.context AS output_context,
        t.name,
        t.description,
        t.is_unique,
        t.function_string,
        s.processing_graph,
        s.address,
        s.port
    FROM task_execution te
    LEFT JOIN routine_execution re ON te.routine_execution_id = re.uuid
    LEFT JOIN context ctx ON te.context_id = ctx.uuid
    LEFT JOIN context ctx2 ON te.result_context_id = ctx2.uuid
    LEFT JOIN task t ON te.task_id = t.uuid
    LEFT JOIN server s ON re.server_id = s.uuid
    ${id ? 'WHERE te.task_id = $1' : ''}
    ORDER BY te.created DESC
    LIMIT $${id ? '2' : '1'} OFFSET $${id ? '3' : '2'}
    `;

  const params = id ? [id, limit, offset] : [limit, offset];
  const result = await client.query(query, params);

  // Map the results to match the expected frontend format
  const mappedRows = result.rows.map((row) => ({
    uuid: row.uuid,
    id: row.uuid,
    type: 'task',
    routineExecutionId: row.routine_execution_id,
    taskId: row.task_id,
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
    serverId: row.server_id,
    routineName: row.routine_name,
    contextId: row.context_id,
    resultContextId: row.result_context_id,
    inputContext: row.input_context,
    outputContext: row.output_context,
    name: row.name,
    description: row.description,
    isUnique: row.is_unique,
    functionString: row.function_string,
    serverName: row.processing_graph + '@' + row.address + ':' + row.port,
    server: row.processing_graph + '@' + row.address + ':' + row.port,
    layerIndex: row.layer_index,
    previousTaskName: row.previous_task_name,
    processingGraph: row.processing_graph,
    referer: row.errored ? 'Errored' : null,
    status: row.isComplete
      ? 'check'
      : row.isRunning
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
      const id = query.id as string | undefined;
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;

      return await getTaskExecution(id, page, limit);
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  }
});
