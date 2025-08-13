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
    COUNT(*) as executions,
    SUM(CASE WHEN errored THEN 1 ELSE 0 END) as errored,
    SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as reached_timeout,
    SUM(CASE WHEN is_complete THEN 1 ELSE 0 END)as is_complete
FROM
    task_execution
WHERE
    task_id = $1
  `;
  const client = await getClient();
  const result = await client.query(query, [taskId]);
  return result.rows;
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
