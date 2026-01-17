import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

async function getRoutine(routineName: string, version?: string | null, service?: string | null) {
  let query = supabaseAdmin
    .from('routine')
    .select(`
      *,
      task_to_routine_map!inner(
        task!inner(name, version, service_name)
      )
    `)
    .eq('name', routineName)
    .eq('is_meta', false);

  // For version and service filtering, we need to filter on the joined data
  // This is complex in Supabase, so we'll fetch and filter client-side for now
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let filteredData = data;

  if (version || service) {
    filteredData = data.filter(routine => {
      const tasks = routine.task_to_routine_map || [];
      return tasks.some((taskMap: any) => {
        const task = taskMap.task;
        if (!task) return false;
        if (version && task.version !== version) return false;
        if (service && task.service_name !== service) return false;
        return true;
      });
    });
  }

  return filteredData.map((routine: any) => ({
    type: routine.type,
    name: routine.name,
    description: routine.description,
    function_string: routine.function_string,
    service_instance: routine.service_instance,
    created: routine.created,
    deleted: routine.deleted,
    service: routine.service_name,
    version: routine.version,
  }));
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const routineName = event.context.params?.id ?? '';

  if (method === 'GET') {
    try {
      const query = getQuery(event) as Record<string, any>;
      const version = (query.version as string) || (query.v as string) || null;
      const service = (query.service as string) || (query.serviceName as string) || (query.service_name as string) || null;
      return await getRoutine(routineName, version, service);
    } catch (error) {
      console.error('Error fetching routine:', error);
      throw error;
    }
  }
});
