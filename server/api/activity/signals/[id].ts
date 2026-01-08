import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getEmissionByUuid(uuid: string) {
  const query = `
    SELECT *
    FROM signal_emission
    WHERE uuid = $1
    ORDER BY emitted_at DESC
  `;
  const res = await client!.query(query, [uuid]);
  return res.rows;
}

async function getConsumptionsForEmissionId(signalEmissionId: string) {
  const query = `
    SELECT DISTINCT te.uuid AS task_execution_id, te.task_name, te.service_name, se.signal_name, te.created
    FROM task_execution te
    LEFT JOIN signal_emission se ON te.signal_emission_id = se.uuid
    WHERE te.signal_emission_id = $1 AND se.signal_name IS NOT NULL
    ORDER BY te.created DESC
    LIMIT 200
  `;
  const res = await client!.query(query, [signalEmissionId]);
  return res.rows;
}

async function getTaskExecutionsByIds(ids: string[]) {
  if (!ids || ids.length === 0) return [];
  const query = `SELECT * FROM task_execution WHERE uuid = ANY($1::uuid[])`;
  const res = await client!.query(query, [ids]);
  return res.rows;
}

async function getTaskByName(name: string) {
  const query = `SELECT task_name, service_name, description, task_version as version FROM task WHERE task_name = $1 LIMIT 1`;
  const res = await client!.query(query, [name]);
  return res.rows[0] || null;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const uuid = event.context.params?.id as string | undefined;

      if (!uuid) {
        throw new Error('Signal `id` (uuid) must be provided as a route parameter');
      }

      console.log('Fetching signal emission for uuid:', uuid);

      const emissions = await getEmissionByUuid(uuid);
      if (!emissions || emissions.length === 0) {
        return { error: 'Signal emission not found', uuid };
      }

      const emission = emissions[0];

      const consumptions = await getConsumptionsForEmissionId(emission.uuid);

      const execIds = new Set<string>();
      if (emission.task_execution_id) execIds.add(emission.task_execution_id);
      for (const c of consumptions) {
        if (c.task_execution_id) execIds.add(c.task_execution_id);
      }

      const taskExecutionIds = Array.from(execIds);
      const taskExecutions = await getTaskExecutionsByIds(taskExecutionIds);
      
      const previousTasks: any[] = [];
      if (emission.task_execution_id) {
        const emissionExecution = taskExecutions.find((te: any) => te.uuid === emission.task_execution_id) || null;
        if (emissionExecution) {
          previousTasks.push({
            task_name: emission.task_name || emissionExecution.task_name,
            task_version: emission.task_version || emissionExecution.task_version,
            task_execution: emissionExecution,
            service_name: emissionExecution.service_name
          });
        }
      }

      const nextTasks = consumptions.map((c: any) => ({
        task_name: c.task_name,
        task_version: c.task_version,
        service_name: c.service_name,
        task_execution_id: c.task_execution_id
      }));

      return {
        emission,
        consumptions,
        taskExecutions,
        previousTasks,
        nextTasks
      };
    } catch (error) {
      console.error('Error fetching signal emission or related records:', error);
      throw error;
    }
  }
});
