import { supabaseAdmin } from '~/utils/supabase';

async function getRoutineMap() {
  // Using Supabase RPC for complex queries
  // You could also create a stored procedure in Postgres and call it via RPC
  const { data, error } = await supabaseAdmin.rpc('get_routine_execution_stats');

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
  const routineId = url.searchParams.get('routineId');

  if (method === 'GET') {
    try {
      return await getRoutineMap();
    } catch (error) {
      console.error('Error fetching routineExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineId });
    return { error: 'Invalid request' };
  }
});
