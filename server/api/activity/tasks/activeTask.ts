import { supabaseAdmin } from '~/utils/supabase';
import { formatDate, getDuration } from '~/server/api/utils';
import { getQuery } from 'h3';

// Get a single TaskExecution by ID
async function getSingleTaskExecution(id: string) {
  const { data, error } = await supabaseAdmin
    .from('task_execution')
    .select(`
      uuid,
      routine_execution_id,
      execution_trace_id,
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
        routine!left(name, description)
      ),
      task!left(name, description, is_unique, function_string)
    `)
    .eq('uuid', id)
    .eq('is_meta', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`TaskExecution with ID ${id} not found`);
    }
    throw error;
  }

  return {
    uuid: data.uuid,
    id: data.uuid,
    type: 'task',
    routineExecutionId: data.routine_execution_id,
    execution_trace_id: data.execution_trace_id,
    executionTraceId: data.execution_trace_id,
    taskId: data.task_name,
    taskVersion: data.task_version,
    isRunning: data.is_running,
    isComplete: data.is_complete,
    errored: data.errored,
    failed: data.failed,
    progress: data.progress,
    scheduled: data.created,
    started: formatDate(data.started),
    ended: formatDate(data.ended),
    duration: getDuration(data.started, data.ended),
    inputContext: data.context,
    outputContext: data.result_context,
    name: data.task?.[0]?.name,
    description: data.task?.[0]?.description,
    isUnique: data.task?.[0]?.is_unique,
    functionString: data.task?.[0]?.function_string,
    serviceName: data.service_name,
    routineName: data.routine_execution?.[0]?.routine?.[0]?.description,
  };
}

// Event handler
export default defineEventHandler(async (event) => {
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