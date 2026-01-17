import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

async function getRoutine(routineName: string, version?: string | null, service?: string | null) {
  let query = supabaseAdmin
    .from('routine')
    .select('*')
    .eq('name', routineName)
    .eq('is_meta', true);

  if (version || service) {
    // For filtering by version or service, we need to join with task_to_routine_map and task
    query = supabaseAdmin
      .from('routine')
      .select(`
        *,
        task_to_routine_map!inner(
          task!inner(
            version,
            service_name
          )
        )
      `)
      .eq('name', routineName)
      .eq('is_meta', true);

    if (version) {
      query = query.eq('task_to_routine_map.task.version', version);
    }
    if (service) {
      query = query.eq('task_to_routine_map.task.service_name', service);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Format the routine data
  return data.map((routine: any) => ({
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
