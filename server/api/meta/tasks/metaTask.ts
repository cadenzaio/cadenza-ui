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
      task_name,
      is_running,
      is_complete,
      errored,
      failed,
      progress,
      created,
      started,
      ended,
      routine_execution!left(
        service_name,
        routine!left(description)
      ),
      context!left(uuid, context),
      result_context!left(uuid, context),
      task!left(name, description, is_unique, function_string)
    `)
    .eq('uuid', id)
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
    taskId: data.task_name,
    isRunning: data.is_running,
    isComplete: data.is_complete,
    errored: data.errored,
    failed: data.failed,
    progress: data.progress,
    scheduled: data.created,
    started: formatDate(data.started),
    ended: formatDate(data.ended),
    duration: getDuration(data.started, data.ended),
    contextId: data.context?.[0]?.uuid,
    resultContextId: data.result_context?.[0]?.uuid,
    inputContext: data.context?.[0]?.context,
    outputContext: data.result_context?.[0]?.context,
    name: data.task?.[0]?.name,
    description: data.task?.[0]?.description,
    isUnique: data.task?.[0]?.is_unique,
    functionString: data.task?.[0]?.function_string,
    serviceName: data.routine_execution?.[0]?.service_name,
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