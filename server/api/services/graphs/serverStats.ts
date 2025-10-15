import pg from 'pg';
import { initializeClient, formatDateLocale } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getAllServersWithStats(serviceInstance?: string) {
  let query = `
    SELECT
        s.uuid,
        s.address,
        s.port,
        s.process_pid,
        s.is_primary,
        s.is_active,
        s.is_non_responsive,
        s.is_blocked,
        s.modified
    FROM service_instance s
    WHERE s.is_active = true
  `;
  const values: (string | number)[] = [];
  if (serviceInstance) {
    query += ` AND s.service_instance = $1`;
    values.push(serviceInstance);
  }

  query += ` ORDER by s.modified DESC`;

  const result = await client!.query(query, values);
  return result.rows.map((row) => ({
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
  if (!client) {
    client = await initializeClient();
  }

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
