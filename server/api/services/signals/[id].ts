import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getSignal(name: string, serviceName: string) {
  const query = `
    SELECT 
    name, 
    domain, 
    action, 
    is_meta, 
    service_name, 
    created, 
    deleted
    FROM signal_registry
    WHERE name = $1 AND service_name = $2 AND is_meta = false
    ORDER BY name ASC
  `;

  console.log('Executing query:', query, 'with parameters:', [name, serviceName]);

  const res = await client!.query(query, [name, serviceName]);
  return res.rows;
}

async function getPreviousTasksForSignal(signalName: string, serviceName: string) {
  const query = `
    SELECT DISTINCT 
      t.name AS task_name, 
      t.description AS task_description,
      tsm.signal_name,
      tsm.service_name
    FROM task_to_signal_map tsm
    JOIN task t ON tsm.task_name = t.name
    WHERE tsm.signal_name = $1 AND tsm.service_name = $2 AND is_meta = false
    ORDER BY t.name ASC
  `;

  console.log('Executing query:', query, 'with parameters:', [signalName, serviceName]);

  const res = await client!.query(query, [signalName, serviceName]);
  return res.rows;
}

async function getNextTasksForSignal(signalName: string, serviceName: string) {
  const query = `
    SELECT 
      tsm.task_name, 
      t.description AS task_description,
      tsm.signal_name,
      tsm.task_service_name AS service_name
    FROM signal_to_task_map tsm
    JOIN task t ON tsm.task_name = t.name
    WHERE tsm.signal_name = $1 AND tsm.signal_service_name = $2 AND is_meta = false
    ORDER BY t.name ASC
  `;

  console.log('Executing query:', query, 'with parameters:', [signalName, serviceName]);

  const res = await client!.query(query, [signalName, serviceName]);
  return res.rows;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const signal = event.context.params?.id; 
      const serviceName = query.serviceName as string; 

      if (!signal || !serviceName) {
        throw new Error('Both signal and serviceName must be provided');
      }

      console.log('Received signal parameter:', signal, 'and serviceName parameter:', serviceName);

      const signals = await getSignal(signal, serviceName);

      const signalsWithTasks = await Promise.all(signals.map(async (signal) => {
        const previousTasks = await getPreviousTasksForSignal(signal.name, serviceName);
        const nextTasks = await getNextTasksForSignal(signal.name, serviceName);
        return { ...signal, previousTasks, nextTasks };
      }));

      return signalsWithTasks;
    } catch (error) {
      console.error('Error fetching signals or tasks:', error);
      throw error;
    }
  }
});
