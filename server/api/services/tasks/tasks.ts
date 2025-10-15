import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all Tasks with pagination support
async function getTasks(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;
  const query = `
    SELECT * FROM task
    WHERE is_meta = false
    ORDER BY name ASC
    LIMIT $1 OFFSET $2
  `;
  const res = await client!.query(query, [limit, offset]);

  // Map the results to match the component's expected format
  return res.rows.map((row) => ({
    type: 'task',
    label: row.name,
    description: row.description,
    uuid: row.uuid,
    service: row.service_name,
    unique: row.is_unique,
    concurrency: row.concurrency,
    name: row.name,
  }));
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;
      return await getTasks(page, limit);
    } catch (error) {
      console.error('Error fetching Tasks:', error);
      throw error;
    }
  }
});
