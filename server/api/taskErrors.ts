import { supabaseAdmin } from '~/utils/supabase';

async function gettaskMap(taskName: string) {
  // Using Supabase RPC for complex queries with parameters
  const { data, error } = await supabaseAdmin.rpc('get_task_execution_stats_by_name', {
    task_name: taskName
  });

  if (error) {
    throw error;
  }

  return data;
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const taskName = url.searchParams.get('taskName');

  if (method === 'GET' && taskName) {
    try {
      return await gettaskMap(taskName);
    } catch (error) {
      console.error('Error fetching taskExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, taskName });
    return { error: 'Invalid request' };
  }
});
