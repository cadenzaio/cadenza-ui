import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

// Get all routines with pagination support
async function getRoutines(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;

  const { data, error } = await supabaseAdmin
    .from('routine')
    .select('*')
    .eq('is_meta', true)
    .order('created', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  // Map the results to match the expected interface - all data manipulation happens here
  return data.map((row) => ({
    type: 'routine',
    label: row.name,
    uuid: row.uuid,
    description: row.description,
    service: row.service_name,
    version: row.version,
  }));
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;

      return await getRoutines(page, limit);
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
