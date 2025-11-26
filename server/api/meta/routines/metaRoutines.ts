import pg from 'pg';
import { version } from 'vue';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all routines with pagination support
async function getRoutines(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;
  const query = `
    SELECT * FROM routine
    WHERE is_meta = true
    ORDER BY created DESC
    LIMIT $1 OFFSET $2;
  `;
  const res = await client!.query(query, [limit, offset]);

  // Map the results to match the expected interface - all data manipulation happens here
  return res.rows.map((row) => ({
    type: 'routine',
    label: row.name,
    uuid: row.uuid,
    description: row.description,
    service: row.service_name,
    version: row.version,
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

      return await getRoutines(page, limit);
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
