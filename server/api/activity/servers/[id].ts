import { initializeClient } from '~/server/api/utils';
import pg from 'pg';
import { createError } from 'h3';

let client: pg.Client | null = null;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function getService(serviceId: string) {
  const baseSelect = `
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
  `;

  if (isUuid(serviceId)) {
    const query = baseSelect + ` WHERE si.uuid = $1;`;
    const result = await client!.query(query, [serviceId]);
    return result.rows;
  }

  // Fallback: try matching by service_name when the provided id is not a UUID.
  const queryByName = baseSelect + ` WHERE si.service_name = $1;`;
  const result = await client!.query(queryByName, [serviceId]);
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
    } catch (error: any) {
      console.error('Error fetching routine:', error);
      if (error && error.code === '22P02') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid service id' });
      }
      throw error;
    }
  }
});
