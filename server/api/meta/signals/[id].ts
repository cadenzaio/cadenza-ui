import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

async function getSignal(name: string) {
  const { data, error } = await supabaseAdmin
    .from('signal_registry')
    .select('name, domain, action, is_meta, is_global, created, deleted')
    .eq('name', name)
    .eq('is_meta', true)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function getPreviousTasksForSignal(signalName: string) {
  const { data, error } = await supabaseAdmin.rpc('get_tasks_emitting_signal', {
    signal_name: signalName
  });

  if (error) {
    throw error;
  }

  return data;
}

async function getNextTasksForSignal(signalName: string) {
  const { data, error } = await supabaseAdmin.rpc('get_tasks_observing_signal', {
    signal_name: signalName
  });

  if (error) {
    throw error;
  }

  return data;
}

export default defineEventHandler(async (event) => {
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
