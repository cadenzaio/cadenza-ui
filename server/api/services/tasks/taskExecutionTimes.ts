import { supabaseAdmin } from '~/utils/supabase';

async function getTaskMap(taskId: string) {
  // Using Supabase RPC for complex aggregate queries
  const { data, error } = await supabaseAdmin.rpc('get_task_execution_times', {
    task_id: taskId
  });

  if (error) {
    console.error('Error executing query:', error);
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
  const taskId = url.searchParams.get('taskId');

  if (method === 'GET' && taskId) {
    try {
      return await getTaskMap(taskId);
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, taskId });
    return { error: 'Invalid request' };
  }
});
