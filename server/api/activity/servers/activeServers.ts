import pg from 'pg';
import { initializeClient, formatDateLocale } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function getAllServersWithStats(
  serviceInstanceUuid?: string,
  page: number = 1,
  limit: number = 100
) {
  const offset = (page - 1) * limit;
  let query = `
    SELECT
        si.uuid,
        si.address,
        si.port,
        si.process_pid,
        si.is_primary,
        si.is_active,
        si.is_non_responsive,
        si.is_blocked,
        si.service_name,
        si.modified
    FROM service_instance si
    WHERE si.is_active = true
  `;
  const values: (string | number)[] = [];

  if (serviceInstanceUuid) {
    query += ` AND si.uuid = $${values.length + 1}`;
    values.push(serviceInstanceUuid);
  }

  query += ` ORDER by si.modified DESC LIMIT $${values.length + 1} OFFSET $${
    values.length + 2
  }`;
  values.push(limit, offset);

  const result = await client!.query(query, values);
  return {
    servers: result.rows.map((row) => ({
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
  if (!client) {
    client = await initializeClient();
  }

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
