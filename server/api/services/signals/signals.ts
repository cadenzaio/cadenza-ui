import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function getSignals(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;
  const query = `
    SELECT 
    name, 
    domain, 
    action, 
    is_meta, 
    is_global, 
    created, 
    deleted
    FROM signal_registry
    WHERE is_meta = false
    ORDER BY name ASC
    LIMIT $1 OFFSET $2
  `;

  const res = await client!.query(query, [limit, offset]);
  return res.rows;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 1000;
      return await getSignals(page, limit);
    } catch (error) {
      console.error('Error fetching signals:', error);
      throw error;
    }
  }
});
