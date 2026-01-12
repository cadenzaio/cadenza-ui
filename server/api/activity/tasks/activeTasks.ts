import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

// Get all TaskExecutions with pagination support
async function getTaskExecution(
  name?: string,
  page: number = 1,
  limit: number = 100,
  startedAfter?: string,
  startedBefore?: string,
  service?: string
) {
  if (!client) {
    client = await initializeClient();
  }

  const offset = (page - 1) * limit;

  let whereClause = 'WHERE te.is_meta = false';
  const params: any[] = [];
  let paramIndex = 1;

  if (name) {
    whereClause += ` AND te.task_name = $${paramIndex}`;
    params.push(name);
    paramIndex++;
  }

  if (startedAfter) {
    whereClause += ` AND te.started >= $${paramIndex}`;
    params.push(startedAfter);
    paramIndex++;
  }

  if (startedBefore) {
    whereClause += ` AND te.started < $${paramIndex}`;
    params.push(startedBefore);
    paramIndex++;
  }

  if (service) {
    whereClause += ` AND te.service_name = $${paramIndex}`;
    params.push(service);
    paramIndex++;
  }

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
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
  params.push(limit, offset);
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
      const startedAfter = query.started_after as string | undefined;
      const startedBefore = query.started_before as string | undefined;
      const service = query.service as string | undefined;

      return await getTaskExecution(name, page, limit, startedAfter, startedBefore, service);
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  }
});
