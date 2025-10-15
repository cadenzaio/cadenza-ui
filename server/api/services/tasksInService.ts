import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function ensureClient() {
  if (!client) {
    client = await initializeClient();
  }
}

async function getTasksByServiceIdentifier(identifier: string, isUuid = false) {
  if (!client) {
    throw new Error('Database client is not initialized');
  }

  let serviceName: string | null = null;

  if (isUuid) {
    // Lookup the service_name from the service table
    const lookup = await client.query(
      `SELECT service_name FROM service WHERE name = $1 LIMIT 1`,
      [identifier]
    );
    if (lookup.rows.length === 0) {
      return [];
    }
    serviceName = lookup.rows[0].service_name;
  } else {
    // Normalize serviceName to prevent hidden character issues
    serviceName = decodeURIComponent(identifier).replace(/\s+/g, ' ').trim();
  }

  const query = `
SELECT
  t.name,
  t.description,
  t.layer_index,
  t.is_unique,
  t.concurrency,
  t.service_name,
  t.version,
  dtm.predecessor_task_name AS previous_task_execution_name
FROM task t
LEFT JOIN directional_task_graph_map dtm
  ON t.name = dtm.task_name
  AND t.version = dtm.task_version
  AND t.service_name = dtm.service_name
WHERE t.service_name = $1
  AND (t.deleted IS FALSE OR t.deleted IS NULL);
  `;

  const result = await client.query(query, [serviceName]);

  // Map DB rows to a frontend-friendly shape. The project previously referenced `uuid` on tasks
  // even though `task` in the schema doesn't include a UUID. For compatibility we synthesize a
  // stable id using the task name (frontend treats it like an identifier string).
  return result.rows.map((row: any) => ({
    uuid: String(row.name), // synthetic identifier (task name)
    name: row.name,
    description: row.description,
    processing_graph: row.service_name,
    layer_index: row.layer_index,
    is_unique: row.is_unique,
    concurrency: row.concurrency,
    version: row.version,
    previous_task_execution_name: row.previous_task_execution_name,
  }));
}

export default defineEventHandler(async (event) => {
  await ensureClient();

  const query = getQuery(event);

  // Accept either serviceUuid or serviceName for backward compatibility
  const serviceUuid = (query.serviceUuid as string) || (query.serviceInstance as string);
  const serviceName = (query.serviceName as string) || (query.service as string);

  if (!serviceUuid && !serviceName) {
    throw new Error('Missing required query parameter: serviceUuid or serviceName');
  }

  if (event.node.req.method === 'GET') {
    try {
      if (serviceUuid) {
        return await getTasksByServiceIdentifier(serviceUuid, true);
      }
      return await getTasksByServiceIdentifier(serviceName || '', false);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }
});
