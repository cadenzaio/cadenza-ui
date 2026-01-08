import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function getSignal(name: string) {
  const query = `
    SELECT 
    name, 
    domain, 
    action, 
    is_meta, 
    is_global, 
    created, 
    deleted
    FROM signal_registry
    WHERE name = $1 AND is_meta = false
    ORDER BY name ASC
  `;

  console.log('Executing query:', query, 'with parameters:', [name]);

  const res = await client!.query(query, [name]);
  return res.rows;
}

async function getPreviousTasksForSignal(signalName: string) {
  const query = `
    SELECT DISTINCT 
      name AS task_name, 
      description AS task_description,
      service_name
    FROM task
    WHERE signals->'emits' ? $1 AND is_meta = false
    ORDER BY name ASC
  `;

  console.log('Executing query:', query, 'with parameters:', [signalName]);

  const res = await client!.query(query, [signalName]);
  return res.rows;
}

async function getNextTasksForSignal(signalName: string) {
  const query = `
    SELECT DISTINCT
      name AS task_name, 
      description AS task_description,
      service_name
    FROM task
    WHERE signals->'observed' ? $1 AND is_meta = false
    ORDER BY name ASC
  `;

  console.log('Executing query:', query, 'with parameters:', [signalName]);

  const res = await client!.query(query, [signalName]);
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

      if (!signal) {
        throw new Error('Signal parameter must be provided');
      }

      console.log('Received signal parameter:', signal);

      const signals = await getSignal(signal);

      const signalsWithTasks = await Promise.all(signals.map(async (signal) => {
        const previousTasks = await getPreviousTasksForSignal(signal.name);
        const nextTasks = await getNextTasksForSignal(signal.name);
        return { ...signal, previousTasks, nextTasks };
      }));

      return signalsWithTasks;
    } catch (error) {
      console.error('Error fetching signals or tasks:', error);
      throw error;
    }
  }
});
