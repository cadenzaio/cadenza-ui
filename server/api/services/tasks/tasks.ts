import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

async function getTasks(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;

  const { data, error } = await supabaseAdmin
    .from('task')
    .select('*')
    .eq('is_meta', false)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return data.map((row) => ({
    type: 'task',
    label: row.name,
    description: row.description,
    uuid: row.uuid,
    service: row.service_name,
    version: row.version,
    unique: row.is_unique,
    concurrency: row.concurrency,
    name: row.name,
  }));
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;
      return await getTasks(page, limit);
    } catch (error) {
      console.error('Error fetching Tasks:', error);
      throw error;
    }
  }
});
