import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all servers
async function getAllServers() {
  const query = `
        SELECT
    si.uuid AS server_id,
    s2s.service_instance_client_id AS client_id,
    si.is_active,
    si.is_blocked,
    si.is_non_responsive,
    si.address,
    si.port,
    si.service_name
    FROM service_instance si
    LEFT JOIN service_to_service_communication_map s2s ON si.uuid = s2s.service_instance_id
    LEFT JOIN service s ON si.service_name = s.name
    WHERE s.is_meta = false
  `;
  const result = await client!.query(query);
  return result.rows;
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  const { serverId } = event.context.params || {};

  if (method === 'GET') {
    return getAllServers();
  }
});
