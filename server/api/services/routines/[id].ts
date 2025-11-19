import { initializeClient } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

async function getRoutine(routineName: string) {
  const query = `
    SELECT *
    FROM routine
    WHERE name = $1 AND is_meta = false;
  `;
  const result = await client!.query(query, [routineName]);

  // Format the routine data
  return result.rows.map((routine: any) => ({
    type: routine.type,
    name: routine.name,
    description: routine.description,
    function_string: routine.function_string,
    service_instance: routine.service_instance,
    created: routine.created,
    deleted: routine.deleted,
    service: routine.service_name,
  }));
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  const routineName = event.context.params?.id ?? '';

  if (method === 'GET') {
    try {
      return await getRoutine(routineName);
    } catch (error) {
      console.error('Error fetching routine:', error);
      throw error;
    }
  }
});
