import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function ensureClient() {
  if (!client) {
    client = await initializeClient();
  }
}

async function getTasks(serviceName: string) {
  if (!client) {
    throw new Error('Database client is not initialized');
  }

  // Normalize serviceName to prevent hidden character issues
  serviceName = decodeURIComponent(serviceName).replace(/\s+/g, ' ').trim();

  const query = `
SELECT
  t.processing_graph,
  t.uuid AS uuid,
  t.name,
  t.description,
  t.layer_index,
  t.is_unique,
  t.concurrency,
  dtm.task_id,
  dtm.predecessor_task_id AS previous_task_execution_id
FROM task t
LEFT JOIN directional_task_graph_map dtm ON t.uuid = dtm.task_id
WHERE processing_graph::TEXT = $1;
  `;

  const result = await client.query(query, [serviceName]);
  return result.rows;
}

export default defineEventHandler(async (event) => {
  await ensureClient();

  const query = getQuery(event);
  const serviceName = query.serviceName as string;

  if (!serviceName) {
    throw new Error('Missing required query parameter: serviceName');
  }

  if (event.node.req.method === 'GET') {
    try {
      return await getTasks(serviceName);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }
});
