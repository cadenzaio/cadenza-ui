import { supabaseAdmin } from '~/utils/supabase';
import { formatDate, getDuration } from '~/server/api/utils';
import { getQuery } from 'h3';

// Get all TaskExecutions with pagination support
async function getTaskExecution(
  name?: string,
  page: number = 1,
  limit: number = 100,
  startedAfter?: string,
  startedBefore?: string,
  service?: string
) {
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('task_execution')
    .select(`
      uuid,
      routine_execution_id,
      task_name,
      task_version,
      service_name,
      context,
      meta_context,
      result_context,
      meta_result_context,
      is_running,
      is_complete,
      errored,
      failed,
      progress,
      created,
      started,
      ended,
      routine_execution!left(
        service_instance_id,
        routine!left(name, description)
      ),
      task!left(name, description, is_unique, function_string, layer_index)
    `)
    .eq('is_meta', false)
    .order('created', { ascending: false })
    .range(offset, offset + limit - 1);

  if (name) {
    query = query.eq('task_name', name);
  }

  if (startedAfter) {
    query = query.gte('started', startedAfter);
  }

  if (startedBefore) {
    query = query.lt('started', startedBefore);
  }

  if (service) {
    query = query.eq('service_name', service);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Map the results to match the expected frontend format
  const mappedRows = data.map((row) => {
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
      scheduled: row.created,
      started: formatDate(row.started),
      ended: formatDate(row.ended),
      duration: getDuration(row.started, row.ended),
      serviceDbName: row.service_name,
      routineName: row.routine_execution?.[0]?.routine?.[0]?.description,
      inputContext: row.context,
      outputContext: row.result_context,
      name: row.task?.[0]?.name,
      description: row.task?.[0]?.description,
      isUnique: row.task?.[0]?.is_unique,
      functionString: row.task?.[0]?.function_string,
      serviceName: row.service_name,
      layerIndex: row.task?.[0]?.layer_index,
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
