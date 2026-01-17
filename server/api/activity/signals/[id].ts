import { supabaseAdmin } from '~/utils/supabase';

async function getEmissionByUuid(uuid: string) {
  const { data, error } = await supabaseAdmin
    .from('signal_emission')
    .select('*')
    .eq('uuid', uuid)
    .order('emitted_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

async function getConsumptionsForEmissionId(signalEmissionId: string) {
  const { data, error } = await supabaseAdmin
    .from('task_execution')
    .select(`
      uuid,
      task_name,
      service_name,
      created,
      signal_emission!inner(
        signal_name
      )
    `)
    .eq('signal_emission_id', signalEmissionId)
    .not('signal_emission.signal_name', 'is', null)
    .order('created', { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return data.map(row => ({
    task_execution_id: row.uuid,
    task_name: row.task_name,
    service_name: row.service_name,
    signal_name: row.signal_emission?.[0]?.signal_name,
    created: row.created
  }));
}

async function getTaskExecutionsByIds(ids: string[]) {
  if (!ids || ids.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('task_execution')
    .select('*')
    .in('uuid', ids);

  if (error) {
    throw error;
  }

  return data;
}

async function getTaskByName(name: string) {
  const { data, error } = await supabaseAdmin
    .from('task')
    .select('name, service_name, description, version')
    .eq('name', name)
    .limit(1);

  if (error) {
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
}

export default defineEventHandler(async (event) => {
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
