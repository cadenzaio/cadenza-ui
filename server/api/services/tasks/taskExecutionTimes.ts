import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

// Get TaskExecutions by task_id
async function getTaskMap(taskId: string) {
  const query = `
 SELECT
      MIN(te.started) as started,
      EXTRACT(hour FROM started) as hour,
      DATE_TRUNC('day', started) as date,
      MAX(EXTRACT(EPOCH FROM (ended - started))) as slowest_time,
      MIN(EXTRACT(EPOCH FROM (ended - started))) as fastest_time,
      AVG(EXTRACT(EPOCH FROM (ended - started))) as average_time
    FROM task_execution as te
    WHERE task_id = $1
    GROUP BY date, hour
    ORDER BY started
  `;
  const client = await getClient();
  try {
    const result = await client.query(query, [taskId]);
    return result.rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const taskId = url.searchParams.get('taskId');

  if (method === 'GET' && taskId) {
    try {
      return await getTaskMap(taskId);
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, taskId });
    return { error: 'Invalid request' };
  }
});
