import { supabaseAdmin } from '~/utils/supabase';
import { formatDateLocale } from '~/server/api/utils';
import { getQuery } from 'h3';

async function getAllServersWithStats(serviceInstance?: string) {
  let query = supabaseAdmin
    .from('service_instance')
    .select(`
      uuid,
      service_instance,
      address,
      port,
      process_pid,
      is_primary,
      is_active,
      is_non_responsive,
      is_blocked,
      modified
    `)
    .eq('is_active', true)
    .order('modified', { ascending: false });

  if (serviceInstance) {
    query = query.eq('service_instance', serviceInstance);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data.map((row) => ({
    uuid: row.uuid,
    serviceInstance: row.service_instance,
    address: row.address,
    port: row.port,
    isPrimary: row.is_primary,
    processPid: row.process_pid,
    status: row.is_active ? 'check' : 'schedule',
    modified: formatDateLocale(row.modified),
    is_active: row.is_active,
    is_non_responsive: row.is_non_responsive,
    is_blocked: row.is_blocked,
    displayStatus: row.is_active ? 'Active' : 'Inactive',
  }));
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const serviceInstance = getQuery(event).serviceInstance as
        | string
        | undefined;
      return await getAllServersWithStats(serviceInstance);
    } catch (error) {
      console.error('Error fetching server stats:', error);
      throw error;
    }
  }
});
