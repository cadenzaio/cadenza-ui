import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { defineEventHandler, getQuery } from 'h3';

type ActivityTrace = Record<string, any>;

let client: pg.Client | null = null;

// Get all Activity Traces with pagination support  

async function getActivityTraces(page: number = 1, limit: number = 100) {
  const offset = (page - 1) * limit;
  const query = `
    SELECT * FROM execution_trace
    WHERE is_meta = false
    ORDER BY created DESC
    LIMIT $1 OFFSET $2;
  `;
  const res = await client!.query(query, [limit, offset]);

  // Map the results to match the expected interface - all data manipulation happens here
  return res.rows.map((row) => ({
    type: 'trace',
    uuid: row.uuid,
    service: row.service_name,
    context: row.context_id,
    issuedAt: row.issued_at,
  }));
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
      const limit = parseInt(query.limit as string) || 100;

      return await getActivityTraces(page, limit);
    } catch (error) {
      console.error('Error fetching activity traces:', error);
      throw error;
    }
  }
});