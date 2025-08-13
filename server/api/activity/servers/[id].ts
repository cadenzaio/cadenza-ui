import { initializeClient } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

async function getServer(serverId: string) {
  const query = `
    SELECT
      re.*,
      s.uuid as server_uuid,
      s.address,
      s.port,
      s.process_pid,
      s.is_primary,
      s.is_active,
      s.is_non_responsive,
      s.is_blocked,
      s.processing_graph,
      s.modified as server_modified
    FROM routine_execution re
    RIGHT JOIN server s ON re.server_id = s.uuid
    WHERE s.uuid = $1;
  `;
  const result = await client!.query(query, [serverId]);
  return result.rows;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  const serverId = event.context.params?.id ?? '';

  if (method === 'GET') {
    try {
      return await getServer(serverId);
    } catch (error) {
      console.error('Error fetching routine:', error);
      throw error;
    }
  }
});
