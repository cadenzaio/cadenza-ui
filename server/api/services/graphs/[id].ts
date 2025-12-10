import { initializeClient, formatDateLocale } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

async function getGraph(serviceInstanceId: string) {
  const query = `
    SELECT *
    FROM service s
    WHERE s.name = $1
    LIMIT 1;
  `;

  const result = await client!.query(query, [serviceInstanceId]);

  if (result.rows && result.rows.length > 0) {
    const row = result.rows[0];
    return {
      name: row.name,
      description: row.description,
      modified: formatDateLocale(row.modified),
      deleted: row.deleted,
      created: formatDateLocale(row.created),
      deletedStatus: row.deleted ? 'Yes' : 'No',
      displayName: row.display_name || row.name,
    };
  }

  return null;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  const serviceInstanceId = decodeURIComponent(event.context.params?.id ?? '');

  if (method === 'GET') {
    try {
      return await getGraph(serviceInstanceId);
    } catch (error) {
      console.error('Error fetching graph:', error);
      throw error;
    }
  }
});
