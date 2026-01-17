import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

async function getSignal(name: string) {
  const { data, error } = await supabaseAdmin
    .from('signal_registry')
    .select('name, domain, action, is_meta, is_global, created, deleted')
    .eq('name', name)
    .eq('is_meta', false)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function getPreviousTasksForSignal(signalName: string) {
  // For JSON queries in Supabase, we need to use a different approach
  // This query checks if signalName exists in the 'emits' array of the signals JSON column
  const { data, error } = await supabaseAdmin
    .from('task')
    .select('name, description, service_name, signals')
    .eq('is_meta', false)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  // Filter client-side since Supabase doesn't have direct JSON array contains support
  return data.filter(task => {
    const signals = task.signals || {};
    const emits = signals.emits || [];
    return emits.includes(signalName);
  });
}

async function getNextTasksForSignal(signalName: string) {
  const { data, error } = await supabaseAdmin
    .from('task')
    .select('name, description, service_name, signals')
    .eq('is_meta', false)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  // Filter client-side for observed signals
  return data.filter(task => {
    const signals = task.signals || {};
    const observed = signals.observed || [];
    return observed.includes(signalName);
  });
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
