import { supabaseAdmin } from '~/utils/supabase';

async function getTaskMap(taskName: string) {
  // Using Supabase RPC for complex aggregate queries
  const { data, error } = await supabaseAdmin.rpc('get_task_heatmap_data', {
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
      return await getTaskMap(taskName);
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, taskName });
    return { error: 'Invalid request' };
  }
});
