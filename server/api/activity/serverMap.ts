import { supabaseAdmin } from '~/utils/supabase';

// Get all servers
async function getAllServers() {
  const { data, error } = await supabaseAdmin
    .from('service_instance')
    .select(`
      uuid,
      is_active,
      is_blocked,
      is_non_responsive,
      address,
      port,
      service_name,
      service_to_service_communication_map!left(service_instance_client_id),
      service!inner(is_meta)
    `)
    .eq('service.is_meta', false);

  if (error) {
    throw error;
  }

  return data;
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const { serverId } = event.context.params || {};

  if (method === 'GET') {
    return getAllServers();
  }
});
