import { initializeClient } from '~/server/api/utils';
import pg from 'pg';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

/**
 * Get routine optionally filtered by existence of tasks matching service/version.
 * If `service` or `version` are provided we only return the routine when
 * there exists at least one task in `task_to_routine_map` for this routine
 * that matches the provided filters. This mirrors the way the task endpoint
 * filters by `service`/`version`.
 */
async function getRoutine(routineName: string, version?: string | null, service?: string | null) {
  const params: any[] = [routineName];
  let q = `
    SELECT *
    FROM routine
    WHERE name = $1 AND is_meta = true
  `;

  if (version || service) {
    q += ` AND EXISTS (
      SELECT 1 FROM task_to_routine_map trm
      JOIN task t ON trm.task_name = t.name
      WHERE trm.routine_name = routine.name`;
    if (version) {
      params.push(version);
      q += ` AND t.version = $${params.length}`;
    }
    if (service) {
      params.push(service);
      q += ` AND t.service_name = $${params.length}`;
    }
    q += ` )`;
  }

  q += `;`;

  const result = await client!.query(q, params);

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
    version: routine.version,
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
      const query = getQuery(event) as Record<string, any>;
      const version = (query.version as string) || (query.v as string) || null;
      const service = (query.service as string) || (query.serviceName as string) || (query.service_name as string) || null;
      return await getRoutine(routineName, version, service);
    } catch (error) {
      console.error('Error fetching routine:', error);
      throw error;
    }
  }
});
