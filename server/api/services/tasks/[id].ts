import { supabaseAdmin } from '~/utils/supabase';

async function getTask(taskName: string) {
  const { data, error } = await supabaseAdmin
    .from('task')
    .select(`
      *,
      task_to_routine_map!left(routine_name)
    `)
    .eq('name', taskName);

  if (error) {
    throw error;
  }

  return data;
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const rawId = event.context.params?.id ?? '';
  let taskName = rawId.replace(/\+/g, ' ');
  try {
    taskName = decodeURIComponent(taskName);
  } catch (e) {
    console.warn('Failed to decode task id:', rawId, e);
  }

  if (method === 'GET') {
    try {
      return await getTask(taskName);
    } catch (error) {
      console.error('Error fetching task:', error);
      throw error;
    }
  }
});
