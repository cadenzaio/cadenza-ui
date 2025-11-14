import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

// Get taskExecutions by task_name
async function gettaskMap(taskName: string) {
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
    task_name = $1
  `;
  const client = await getClient();
  const result = await client.query(query, [taskName]);
  return result.rows;
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const taskName = url.searchParams.get('taskName');

  if (method === 'GET' && taskName) {
    try {
      return await gettaskMap(taskName);
    } catch (error) {
      console.error('Error fetching taskExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, taskName });
    return { error: 'Invalid request' };
  }
});
