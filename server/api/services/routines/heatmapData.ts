import { initializeClient } from '~/server/api/utils';
import { Client } from 'pg';

let client: Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

// Get RoutineExecutions by routine_id
async function getRoutineMap(routineId: string) {
  const query = `
    SELECT
      DATE_TRUNC('day', created) as date,
      EXTRACT(hour FROM created) as hour,
      COUNT(*) as executions,
      SUM(CASE WHEN errored THEN 1 ELSE 0 END) +
      SUM(CASE WHEN failed THEN 1 ELSE 0 END) +
      SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as errors
    FROM "routine_execution"
    WHERE "routine_id" = $1
    GROUP BY date, hour
    ORDER BY date, hour
  `;
  const client = await getClient();
  try {
    const result = await client.query(query, [routineId]);
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
  const routineId = url.searchParams.get('routineId');

  if (method === 'GET' && routineId) {
    try {
      return await getRoutineMap(routineId);
    } catch (error) {
      console.error('Error fetching RoutineExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineId });
    return { error: 'Invalid request' };
  }
});
