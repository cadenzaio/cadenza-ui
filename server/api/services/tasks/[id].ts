import { initializeClient } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

async function getTask(taskName: string) {
  const query = `
    SELECT *
    FROM task
    WHERE name = $1;
  `;
  const result = await client!.query(query, [taskName]);
  return result.rows;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  // route params may contain encoded characters (e.g. %20 for spaces)
  // and some clients may send '+' for spaces. Normalize by replacing '+'
  // with ' ' and then running decodeURIComponent.
  const rawId = event.context.params?.id ?? '';
  let taskName = rawId.replace(/\+/g, ' ');
  try {
    taskName = decodeURIComponent(taskName);
  } catch (e) {
    // if decode fails, fall back to the raw value (with pluses converted)
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
