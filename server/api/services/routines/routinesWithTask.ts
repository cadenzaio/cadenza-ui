import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

// Get all routines
async function getRoutineMap(
  taskId: string,
  page: number = 1,
  limit: number = 50
) {
  const offset = (page - 1) * limit;
  const query = `
    SELECT
    r.name,
    r.description
    FROM routine r
    JOIN task_to_routine_map trm ON r.name = trm.routine_name
    JOIN task t ON trm.task_name = t.name
    WHERE t.name = $1 AND is_meta = false
    ORDER BY r.name ASC
    LIMIT $2 OFFSET $3;
  `;
  const result = await client!.query(query, [taskId, limit, offset]);

  // Map the results to match the expected frontend format
  return result.rows.map((routine) => ({
    name: routine.name,
    description: routine.description,
  }));
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const taskId = query.taskId as string;
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 50;

      return await getRoutineMap(taskId ?? '', page, limit);
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
