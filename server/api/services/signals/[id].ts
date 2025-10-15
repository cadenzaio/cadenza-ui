import { initializeClient, formatDateLocale } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

async function getSignalRegistryRow(signalName: string) {
  const query = `
    SELECT *
    FROM signal_registry
    WHERE name = $1
    LIMIT 1
  `;
  const res = await client!.query(query, [signalName]);
  const row = res.rows[0] ?? null;

  // Fetch emitters from task_to_signal_map joined to task to return full task objects
  const emittersQuery = `
    SELECT 
    dtm.task_name, 
    dtm.task_version, 
    dtm.last_emitted, 
    dtm.emit_count,
    t.description AS task_description, 
    t.service_name AS task_service_name, 
    t.is_unique AS task_is_unique, 
    t.concurrency AS task_concurrency
    FROM task_to_signal_map dtm
    LEFT JOIN task t ON t.name = dtm.task_name
    WHERE dtm.signal_name = $1 AND dtm.deleted = false
    ORDER BY dtm.task_name ASC
  `;
  const emittersRes = await client!.query(emittersQuery, [signalName]);

  const previousTasks = emittersRes.rows.map((e: any) => ({
    type: 'task',
    name: e.task_name,
    label: e.task_name,
    description: e.task_description || null,
  uuid: e.task_name || null,
    service: e.task_service_name || null,
    unique: e.task_is_unique || false,
    concurrency: e.task_concurrency ?? 1,
    task_version: e.task_version,
    last_emitted: e.last_emitted ? formatDateLocale(e.last_emitted) : null,
    emit_count: e.emit_count ?? 0,
  }));

  const previousIds = emittersRes.rows.map((e: any) => e.task_name);
  // Also fetch consumers (tasks that consume this signal) to build downstream nodes
  const consumersQuery = `
    SELECT 
    stm.task_name, 
    stm.task_version, 
    stm.created,
    t.description AS task_description, 
    t.service_name AS task_service_name, 
    t.is_unique AS task_is_unique, 
    t.concurrency AS task_concurrency
    FROM signal_to_task_map stm
    LEFT JOIN task t ON t.name = stm.task_name
    WHERE stm.signal_name = $1 AND stm.deleted = false
    ORDER BY stm.task_name ASC
  `;
  const consumersRes = await client!.query(consumersQuery, [signalName]);

  const consumerTasks = consumersRes.rows.map((e: any) => ({
    type: 'task',
    name: e.task_name,
    label: e.task_name,
    description: e.task_description || null,
    uuid: e.task_name || null,
    service: e.task_service_name || null,
    unique: e.task_is_unique || false,
    concurrency: e.task_concurrency ?? 1,
    task_version: e.task_version,
    created: e.created ? formatDateLocale(e.created) : null,
  }));

  // Build FlowMap items: emitters -> signal -> consumers
  const items: any[] = [];

  // Helper to create stable ids
  const makeTaskId = (taskName: string, version?: any) => `task-${taskName}`;
  const makeSignalId = (sig: string) => `signal-${sig.replace(/[^a-zA-Z0-9-_]/g, '-')}`;

  // Add emitter nodes
  for (const e of previousTasks) {
    items.push({
      id: makeTaskId(e.name, e.task_version),
      name: e.name,
      label: e.label,
      description: e.description,
      previousId: undefined,
    });
  }

  // Add signal node
  const signalId = makeSignalId(signalName);
  const signalItem: any = {
    id: signalId,
    name: signalName,
    label: row.name || signalName,
    description: row.description || `${row.domain || ''}.${row.action || ''}`,
    signal: true,
    previousId: previousTasks.length === 1 ? makeTaskId(previousTasks[0].name, previousTasks[0].task_version) : previousTasks.map((p: any) => makeTaskId(p.name, p.task_version)),
  };
  items.push(signalItem);

  // Add consumer nodes linking to the signal
  for (const c of consumerTasks) {
    items.push({
      id: makeTaskId(c.name, c.task_version),
      name: c.name,
      label: c.label,
      description: c.description,
      previousId: signalId,
    });
  }

  // Return full items array so FlowMap can render emitters, signal, and consumers
  return items;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  // route params may contain encoded characters and pluses for spaces
  const rawId = event.context.params?.id ?? '';
  let signalName = rawId.replace(/\+/g, ' ');
  try {
    signalName = decodeURIComponent(signalName);
  } catch (e) {
    console.warn('Failed to decode signal id:', rawId, e);
  }

  if (method === 'GET') {
    try {
      return await getSignalRegistryRow(signalName);
    } catch (error) {
      console.error('Error fetching signal:', error);
      throw error;
    }
  }
});
