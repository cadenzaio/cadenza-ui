import { initializeClient } from '~/server/api/utils';
import { Client } from 'pg';

let client: Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

// Get RoutineExecutions by routine_Name
async function getRoutineMap(routineName: string) {
  const query = `
    SELECT
      DATE_TRUNC('day', created) as date,
      EXTRACT(hour FROM created) as hour,
      COUNT(*) as executions,
      SUM(CASE WHEN errored THEN 1 ELSE 0 END) +
      SUM(CASE WHEN failed THEN 1 ELSE 0 END) +
      SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as errors
    FROM routine_execution
    WHERE name = $1 AND is_meta = false
    GROUP BY DATE_TRUNC('day', created), EXTRACT(hour FROM created)
    ORDER BY DATE_TRUNC('day', created), EXTRACT(hour FROM created)
  `;
  const client = await getClient();
  try {
    const result = await client.query(query, [routineName]);
    return result.rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const routineName = url.searchParams.get('routineName');

  if (method === 'GET' && routineName) {
    try {
      return await getRoutineMap(routineName);
    } catch (error) {
      console.error('Error fetching RoutineExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineName });
    return { error: 'Invalid request' };
  }
});
