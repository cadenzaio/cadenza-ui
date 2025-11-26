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
async function getTaskMap(taskName: string) {
  const query = `
    SELECT
      DATE_TRUNC('day', created) as date,
      EXTRACT(hour FROM created) as hour,
      COUNT(*) as executions,
      SUM(CASE WHEN errored THEN 1 ELSE 0 END) +
      SUM(CASE WHEN failed THEN 1 ELSE 0 END) +
      SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as errors
    FROM task_execution
    WHERE task_name = $1
    GROUP BY date, hour
    ORDER BY date, hour
  `;
  const client = await getClient();
  const result = await client.query(query, [taskName]);
  return result.rows;
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const taskName = url.searchParams.get('taskName');

  if (method === 'GET' && taskName) {
    try {
      return await getTaskMap(taskName);
    } catch (error) {
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, taskName });
    return { error: 'Invalid request' };
  }
});
