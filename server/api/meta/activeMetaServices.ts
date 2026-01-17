import { supabaseAdmin } from '~/utils/supabase';
import { formatDateLocale } from '~/server/api/utils';
import { getQuery } from 'h3';

async function getAllServersWithStats(
  serviceInstanceUuid?: string,
  page: number = 1,
  limit: number = 100
) {
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('service_instance')
    .select(`
      uuid,
      address,
      port,
      process_pid,
      is_primary,
      is_active,
      is_non_responsive,
      is_blocked,
      service_name,
      modified,
      service!left(is_meta)
    `)
    .eq('is_active', true)
    .eq('service.is_meta', true)
    .order('modified', { ascending: false })
    .range(offset, offset + limit - 1);

  if (serviceInstanceUuid) {
    query = query.eq('uuid', serviceInstanceUuid);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return {
    servers: data.map((row) => ({
      uuid: row.uuid,
      service: row.service_name,
      address: row.address,
      port: row.port,
      processPid: row.process_pid,
      status: row.is_active ? 'check' : 'schedule',
      isPrimary: row.is_primary,
      modified: formatDateLocale(row.modified),
      displayStatus: row.is_active ? 'Active' : 'Inactive',
    })),
  };
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const q = getQuery(event);
      // frontend sends `serviceInstance` (uuid) when filtering by a single instance
      const serviceInstance = q.serviceInstance as string | undefined;
      const page = parseInt((q.page as string) || '1', 10) || 1;
      const limit = parseInt((q.limit as string) || '100', 10) || 100;
      return await getAllServersWithStats(serviceInstance, page, limit);
    } catch (error) {
      console.error('Error fetching server stats:', error);
      throw error;
    }
  }
});
