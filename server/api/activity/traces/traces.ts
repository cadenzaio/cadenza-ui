import { supabaseAdmin } from '~/utils/supabase';
import { defineEventHandler, getQuery } from 'h3';

type ActivityTrace = Record<string, any>;

// Get all Activity Traces with pagination support
async function getActivityTraces(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;

  const { data, error } = await supabaseAdmin
    .from('execution_trace')
    .select('*')
    .eq('is_meta', false)
    .order('created', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  // Map the results to match the expected interface - all data manipulation happens here
  return data.map((row) => ({
    type: 'trace',
    uuid: row.uuid,
    service: row.service_name,
    context: row.context_id,
    issuedAt: row.issued_at,
  }));
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;

      return await getActivityTraces(page, limit);
    } catch (error) {
      console.error('Error fetching activity traces:', error);
      throw error;
    }
  }
});