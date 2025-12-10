import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

async function getRoutineMap(routineName: string) {
  const query = `
SELECT
    COUNT(*) as executions,
    SUM(CASE WHEN errored THEN 1 ELSE 0 END) as errored,
    SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as reached_timeout,
    SUM(CASE WHEN is_complete THEN 1 ELSE 0 END)as is_complete
FROM
    routine_execution
WHERE
    name = $1
  `;
  const client = await getClient();
  const result = await client.query(query, [routineName]);
  return result.rows;
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
      console.error('Error fetching routineExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineName });
    return { error: 'Invalid request' };
  }
});
