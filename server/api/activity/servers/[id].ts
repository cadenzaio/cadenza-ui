import { initializeClient } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

async function getService(serviceId: string) {
  const query = `
    SELECT
      re.*,
      si.uuid as service_instance_uuid,
      si.address,
      si.port,
      si.process_pid,
      si.is_primary,
      si.is_active,
      si.service_name,
      si.modified as service_instance_modified
    FROM routine_execution re
    RIGHT JOIN service_instance si ON re.service_instance_id = si.uuid
    WHERE si.uuid = $1;
  `;
  const result = await client!.query(query, [serviceId]);
  return result.rows;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  const serviceId = event.context.params?.id ?? '';

  if (method === 'GET') {
    try {
      return await getService(serviceId);
    } catch (error) {
      console.error('Error fetching routine:', error);
      throw error;
    }
  }
});
