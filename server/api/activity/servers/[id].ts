import { supabaseAdmin } from '~/utils/supabase';
import { createError } from 'h3';

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function getService(serviceId: string) {
  let query = supabaseAdmin
    .from('service_instance')
    .select(`
      uuid,
      address,
      port,
      process_pid,
      is_primary,
      is_active,
      service_name,
      modified,
      routine_execution!left(
        *
      )
    `)
    .limit(1);

  if (isUuid(serviceId)) {
    query = query.eq('uuid', serviceId);
  } else {
    // Fallback: try matching by service_name when the provided id is not a UUID.
    query = query.eq('service_name', serviceId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Return only the first row or null
  return data && data.length > 0 ? data[0] : null;
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const serviceId = event.context.params?.id ?? '';

  if (method === 'GET') {
    try {
      const service = await getService(serviceId);
      return service;
    } catch (error: any) {
      console.error('Error fetching routine:', error);
      if (error && error.code === '22P02') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid service id' });
      }
      throw error;
    }
  }
});
