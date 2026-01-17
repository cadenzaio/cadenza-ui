import { supabaseAdmin } from '~/utils/supabase';

async function getRoutineMap(routineName: string) {
  // Using Supabase RPC for complex queries with parameters
  const { data, error } = await supabaseAdmin.rpc('get_routine_execution_stats_by_name', {
    routine_name: routineName
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
  const routineName = url.searchParams.get('routineName');

  if (method === 'GET' && routineName) {
    try {
      return await getRoutineMap(routineName);
    } catch (error) {
      console.error('Error fetching routineExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineName });
    return { error: 'Invalid request' };
  }
});
