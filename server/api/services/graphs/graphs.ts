import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

// Get all graphs with pagination support
async function getgraphs(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;

  const { data, error } = await supabaseAdmin
    .from('service')
    .select('*')
    .eq('is_meta', false)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  // Map the results to match the ListItem interface
  return data.map((row) => ({
    type: 'service',
    label: row.display_name || row.name,
    uuid: row.uuid,
    description: row.description,
    displayName: row.display_name,
    // include canonical name for routing/navigation
    name: row.name,
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
      return await getgraphs(page, limit);
    } catch (error) {
      console.error('Error fetching graphs:', error);
      throw error;
    }
  }
});
