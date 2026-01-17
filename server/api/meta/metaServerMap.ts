import { supabaseAdmin } from '~/utils/supabase';

// Get all servers
async function getAllServers() {
  const { data, error } = await supabaseAdmin
    .from('service_instance')
    .select(`
      uuid,
      service_instance_client_id,
      is_active,
      is_blocked,
      is_non_responsive,
      address,
      port,
      service_name,
      service_to_service_communication_map!left(
        service_instance_client_id
      ),
      service!left(is_meta)
    `)
    .eq('service.is_meta', true);

  if (error) {
    throw error;
  }

  return data.map(row => ({
    server_id: row.uuid,
    client_id: row.service_to_service_communication_map?.[0]?.service_instance_client_id,
    is_active: row.is_active,
    is_blocked: row.is_blocked,
    is_non_responsive: row.is_non_responsive,
    address: row.address,
    port: row.port,
    service_name: row.service_name,
  }));
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const { serverId } = event.context.params || {};

  if (method === 'GET') {
    return getAllServers();
  }
});
