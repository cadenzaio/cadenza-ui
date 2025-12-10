import { initializeClient } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

async function getTask(taskName: string) {
  const query = `
    SELECT task.*, task_to_routine_map.routine_name
    FROM task
    LEFT JOIN task_to_routine_map
    ON task.name = task_to_routine_map.task_name
    WHERE task.name = $1;
  `;
  const result = await client!.query(query, [taskName]);
  return result.rows;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  const rawId = event.context.params?.id ?? '';
  let taskName = rawId.replace(/\+/g, ' ');
  try {
    taskName = decodeURIComponent(taskName);
  } catch (e) {
    console.warn('Failed to decode task id:', rawId, e);
  }

  if (method === 'GET') {
    try {
      return await getTask(taskName);
    } catch (error) {
      console.error('Error fetching task:', error);
      throw error;
    }
  }
});
