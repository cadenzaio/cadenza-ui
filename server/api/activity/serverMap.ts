import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all servers
async function getAllServers() {
  const query = `
    SELECT
    s.uuid AS server_id,
    s2s.service_instance_client_id AS client_id,
    s.is_active, s.is_blocked,
    s.is_non_responsive,
    s.address,
    s.port,
    s.service_name
    FROM service_instance s
    LEFT JOIN service_to_service_communication_map s2s ON s.uuid = s2s.service_instance_id;
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
