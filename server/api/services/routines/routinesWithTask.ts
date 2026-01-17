import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

async function getRoutineMap(
  taskName: string,
  page: number = 1,
  limit: number = 50
) {
  const { data, error } = await supabaseAdmin.rpc('get_routines_with_task', {
    task_name: taskName,
    page_val: page,
    limit_val: limit
  });

  if (error) {
    console.error('Error executing query:', error);
    throw error;
  }

  return data.map((routine: any) => ({
    name: routine.name,
    description: routine.description,
  }));
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const taskName = query.taskName as string;
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 50;

      return await getRoutineMap(taskName ?? '', page, limit);
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
