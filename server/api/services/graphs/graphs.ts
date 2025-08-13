import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Get all graphs with pagination support
async function getgraphs(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;
  const query = `
    SELECT * FROM processing_graph
    ORDER BY name ASC
    LIMIT $1 OFFSET $2
  `;
  const res = await client!.query(query, [limit, offset]);

  // Map the results to match the ListItem interface
  return res.rows.map((row) => ({
    type: 'graph',
    label: row.name,
    description: row.description,
    uuid: row.name,
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
