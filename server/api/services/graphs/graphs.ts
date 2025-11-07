import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all graphs with pagination support
async function getgraphs(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;
  const query = `
    SELECT * FROM service
    WHERE is_meta = false
    ORDER BY name ASC
    LIMIT $1 OFFSET $2
  `;
  const res = await client!.query(query, [limit, offset]);
  // Map the results to match the ListItem interface

  return res.rows.map((row) => ({
    type: 'service',
    label: row.display_name || row.name,
    uuid: row.uuid,
    description: row.description,
    displayName: row.display_name,
    // include canonical name for routing/navigation
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
      return await getgraphs(page, limit);
    } catch (error) {
      console.error('Error fetching graphs:', error);
      throw error;
    }
  }
});
