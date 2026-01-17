import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

async function getSignals(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;

  const { data, error } = await supabaseAdmin
    .from('signal_registry')
    .select('name, domain, action, is_meta, is_global, created, deleted')
    .eq('is_meta', true)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return data;
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 1000;
      return await getSignals(page, limit);
    } catch (error) {
      console.error('Error fetching signals:', error);
      throw error;
    }
  }
});
