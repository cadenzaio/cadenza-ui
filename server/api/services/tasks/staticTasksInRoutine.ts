import { supabaseAdmin } from '~/utils/supabase';

interface RoutineTask {
  uuid: string;
  name: string;
  label: string;
  layer_index: number;
  previousTaskExecutionName: string | null;
  description: string;
  is_unique: boolean;
  concurrency: number;
}

interface Node {
  uuid: string;
  type: 'task' | 'signal';
  name: string;
  label: string;
  layer_index?: number | null;
  metadata?: Record<string, any>;
  description?: string | null;
  is_unique?: boolean;
  concurrency?: number;
  previousTaskExecutionName?: string | null;
  relation?: 'emitted_by' | 'consumed_by' | string;
  task?: string;
  service_name?: string | null;
  [key: string]: any;
}

async function getRoutineMap(routineName: string): Promise<Node[]> {
  try {
    // Get tasks in routine
    const { data: tasks, error: tasksError } = await supabaseAdmin.rpc('get_static_tasks_in_routine', {
      routine_name_param: routineName
    });

    if (tasksError) {
      throw tasksError;
    }

    const nodes: Node[] = [];

    const taskNames: string[] = tasks.map((t: any) => t.name).filter(Boolean);
    if (taskNames.length === 0) return nodes;

    const emittersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};
    const consumersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};

    tasks.forEach((t: any) => {
      const signals = t.signals || {};
      const emittedSignals = (signals.emits || []).filter((s: string) => !s.startsWith('meta.'));
      const observedSignals = (signals.observed || []).filter((s: string) => !s.startsWith('meta.'));

      emittedSignals.forEach((sigName: string) => {
        if (!emittersMap[sigName]) emittersMap[sigName] = [];
        emittersMap[sigName].push({ task_name: t.name, service_name: t.service_name });
      });

      observedSignals.forEach((sigName: string) => {
        if (!consumersMap[sigName]) consumersMap[sigName] = [];
        consumersMap[sigName].push({ task_name: t.name, service_name: t.service_name });
      });
    });

    const consumedSignals = Object.keys(consumersMap);
    if (consumedSignals.length > 0) {
      const { data: externalEmitters, error: externalError } = await supabaseAdmin.rpc('get_external_signal_emitters', {
        signal_names: consumedSignals
      });

      if (externalError) {
        throw externalError;
      }

      (externalEmitters || []).forEach((t: any) => {
        const signals = t.signals || {};
        const emittedSignals = (signals.emits || []).filter((s: string) => !s.startsWith('meta.'));
        emittedSignals.forEach((sigName: string) => {
          if (consumedSignals.includes(sigName)) {
            if (!emittersMap[sigName]) emittersMap[sigName] = [];
            if (!emittersMap[sigName].some((e) => e.task_name === t.name)) {
              emittersMap[sigName].push({ task_name: t.name, service_name: t.service_name });
            }
          }
        });
      });
    }

    tasks.forEach((task: any) => {
      nodes.push({
        uuid: task.name,
        type: 'task',
        name: task.name,
        label: task.name,
        service_name: task.service_name ?? null,
        version: task.version ?? null,
        layer_index: task.layer_index ?? null,
        description: task.description,
        is_unique: task.is_unique,
        concurrency: task.concurrency ?? undefined,
        previousTaskExecutionName: task.previous_task_execution_name ?? null,
      });
    });

    const allSignals = Array.from(new Set([...Object.keys(emittersMap), ...Object.keys(consumersMap)]));
    const pushedSignals = new Set<string>();
    allSignals.forEach((sig) => {
      if (pushedSignals.has(sig)) return;
      pushedSignals.add(sig);

      const emitters = emittersMap[sig] || [];
      const consumers = consumersMap[sig] || [];
      const prev = emitters.length > 0 ? emitters[0].task_name : null;
      const serviceName = emitters.length > 0 ? emitters[0].service_name ?? null : (consumers.length > 0 ? consumers[0].service_name ?? null : null);

      nodes.push({
        uuid: `signal::${sig}`,
        type: 'signal',
        name: sig,
        label: sig,
        layer_index: null,
        relation: emitters.length > 0 ? 'emitted_by' : 'consumed_by',
        previousTaskExecutionName: prev,
        service_name: serviceName,
      });

      consumers.forEach((c) => {
        nodes.push({
          uuid: c.task_name,
          type: 'task',
          name: c.task_name,
          label: c.task_name,
          layer_index: null,
          description: null,
          is_unique: false,
          concurrency: undefined,
          previousTaskExecutionName: sig,
          service_name: c.service_name ?? null,
          version: null,
        });
      });
    });

    return nodes;
  } catch (error) {
    console.error('Error in getRoutineMap:', error);
    throw error;
  }
}

export default defineEventHandler(async (event) => {
  const { method, url } = event.node.req;
  const routineName = url?.split('=')[1];

  if (method === 'GET') {
    try {
      return await getRoutineMap(routineName ?? '');
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
