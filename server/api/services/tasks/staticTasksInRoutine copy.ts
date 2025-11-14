import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Type for routine task row
interface RoutineTask {
  uuid: string;
  name: string;
  label: string;
  layer_index: number;
  previousTaskExecutionName: string | null;
  description: string;
  is_unique: boolean;
  concurrency: number;
  signalToTaskSignalName: string | null;
  taskToSignalSignalName: string | null;
}

// Generic node shape returned to consumer: tasks and signal nodes
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

// Get all routines
async function getSignalsEmittedByTask(taskName: string, taskLabel?: string, serviceName?: string) {
  const q = `
    SELECT DISTINCT tsm.signal_name, COALESCE(tsm.service_name, sr.service_name) AS service_name
    FROM task_to_signal_map tsm
    JOIN signal_registry sr ON sr.name = tsm.signal_name
    WHERE tsm.task_name = $1 AND sr.is_meta = false
  `;
  // Debug: log the query and task name
  console.debug('[staticTasksInRoutine] getSignalsEmittedByTask - exact query:', q.replace(/\s+/g, ' ').trim(), 'param:', taskName);
  let res = await client!.query(q, [taskName]);
  console.debug('[staticTasksInRoutine] getSignalsEmittedByTask - exact rows:', res.rows.length, res.rows.slice(0,5));

  // Fallback: try looser matches using label or service name if exact returned nothing
  if (res.rows.length === 0 && (taskLabel || serviceName)) {
    const likeLabel = `%${taskLabel ?? taskName}%`;
    // Conservative fallback: try label and a couple of service-name patterns
    // but explicitly exclude meta.* signals to avoid noisy matches.
    if (serviceName) {
      const serviceDot = `%${serviceName}.%`;
      const serviceAny = `%${serviceName}%`;
      const fallbackQ = `
        SELECT DISTINCT tsm.signal_name, COALESCE(tsm.service_name, sr.service_name) AS service_name
        FROM task_to_signal_map tsm
        JOIN signal_registry sr ON sr.name = tsm.signal_name
        WHERE (tsm.task_name ILIKE $1 OR tsm.task_name ILIKE $2 OR tsm.task_name ILIKE $3)
          AND sr.is_meta = false
        LIMIT 50
      `;
      console.debug('[staticTasksInRoutine] getSignalsEmittedByTask - fallback query (service):', fallbackQ.replace(/\s+/g, ' ').trim(), 'params:', likeLabel, serviceDot, serviceAny);
      res = await client!.query(fallbackQ, [likeLabel, serviceDot, serviceAny]);
    } else {
      const fallbackQ = `
        SELECT DISTINCT tsm.signal_name, COALESCE(tsm.service_name, sr.service_name) AS service_name
        FROM task_to_signal_map tsm
        JOIN signal_registry sr ON sr.name = tsm.signal_name
        WHERE tsm.task_name ILIKE $1 AND sr.is_meta = false
        LIMIT 50
      `;
      console.debug('[staticTasksInRoutine] getSignalsEmittedByTask - fallback query (label):', fallbackQ.replace(/\s+/g, ' ').trim(), 'params:', likeLabel);
      res = await client!.query(fallbackQ, [likeLabel]);
    }
    console.debug('[staticTasksInRoutine] getSignalsEmittedByTask - fallback rows:', res.rows.length, res.rows.slice(0,5));
  }
  return res.rows; // [{ signal_name, service_name }, ...]
}

async function getSignalsConsumedByTask(taskName: string, taskLabel?: string, serviceName?: string) {
  const q = `
    SELECT DISTINCT stm.signal_name, stm.signal_service_name AS service_name
    FROM signal_to_task_map stm
    JOIN signal_registry sr ON sr.name = stm.signal_name
    WHERE stm.task_name = $1 AND sr.is_meta = false
  `;
  console.debug('[staticTasksInRoutine] getSignalsConsumedByTask - exact query:', q.replace(/\s+/g, ' ').trim(), 'param:', taskName);
  let res = await client!.query(q, [taskName]);
  console.debug('[staticTasksInRoutine] getSignalsConsumedByTask - exact rows:', res.rows.length, res.rows.slice(0,5));

  if (res.rows.length === 0 && (taskLabel || serviceName)) {
    const likeLabel = `%${taskLabel ?? taskName}%`;
    if (serviceName) {
      const serviceDot = `%${serviceName}.%`;
      const serviceAny = `%${serviceName}%`;
      const fallbackQ = `
        SELECT DISTINCT stm.signal_name, stm.signal_service_name AS service_name
        FROM signal_to_task_map stm
        JOIN signal_registry sr ON sr.name = stm.signal_name
        WHERE (stm.task_name ILIKE $1 OR stm.task_name ILIKE $2 OR stm.task_name ILIKE $3)
          AND sr.is_meta = false
        LIMIT 50
      `;
      console.debug('[staticTasksInRoutine] getSignalsConsumedByTask - fallback query (service):', fallbackQ.replace(/\s+/g, ' ').trim(), 'params:', likeLabel, serviceDot, serviceAny);
      res = await client!.query(fallbackQ, [likeLabel, serviceDot, serviceAny]);
    } else {
      const fallbackQ = `
        SELECT DISTINCT stm.signal_name, stm.signal_service_name AS service_name
        FROM signal_to_task_map stm
        JOIN signal_registry sr ON sr.name = stm.signal_name
        WHERE stm.task_name ILIKE $1 AND sr.is_meta = false
        LIMIT 50
      `;
      console.debug('[staticTasksInRoutine] getSignalsConsumedByTask - fallback query (label):', fallbackQ.replace(/\s+/g, ' ').trim(), 'params:', likeLabel);
      res = await client!.query(fallbackQ, [likeLabel]);
    }
    console.debug('[staticTasksInRoutine] getSignalsConsumedByTask - fallback rows:', res.rows.length, res.rows.slice(0,5));
  }
  return res.rows; // [{ signal_name, service_name }, ...]
}

async function getRoutineMap(routineName: string, debug = false): Promise<Node[] | { nodes: Node[]; diagnostics: Record<string, any> }> {
  // Don't join directional_task_graph_map here because it can have multiple
  // rows per task and would duplicate the task rows (and therefore duplicate
  // signal nodes). We'll fetch predecessor information per-task below.
  const query = `
SELECT DISTINCT
    ttrm.routine_name,
    ttrm.task_name AS name,
    t.name AS label,
    t.service_name AS service_name,
    t.layer_index,
    t.description,
    t.is_unique,
    t.concurrency
FROM task_to_routine_map ttrm
LEFT OUTER JOIN task t ON ttrm.task_name = t.name
WHERE routine_name = $1 AND t.is_meta = false;
  `;

  const result = await client!.query(query, [routineName]);
  console.debug('[staticTasksInRoutine] getRoutineMap - routine query rows:', result.rows.length);
  const tasks = result.rows;

  const nodes: Node[] = [];
  const signalMap = new Map<string, Node>();

  // Diagnostics container (populated only when debug=true)
  const diagnostics: Record<string, any> = {};

  // For each task, create a task node then fetch its signals and add signal nodes.
  await Promise.all(tasks.map(async (task: any) => {
    console.debug('[staticTasksInRoutine] processing task:', task.name, 'raw task row:', task);
    // Fetch predecessor (if any) from directional_task_graph_map per-task so
    // we don't accidentally multiply rows when the graph table has many entries.

    // Fetch all predecessors (if any) from directional_task_graph_map per-task
    // so we can represent multiple previous executions correctly.
    async function getPredecessorsForTask(taskName: string) {
      const q = `
        SELECT predecessor_task_name
        FROM directional_task_graph_map
        WHERE task_name = $1
      `;
      const r = await client!.query(q, [taskName]);
      return r.rows.map((row: any) => row.predecessor_task_name).filter(Boolean);
    }

  const predecessors = await getPredecessorsForTask(task.name);
  console.debug('[staticTasksInRoutine] predecessors for', task.name, predecessors.length, predecessors.slice(0,5));

    const taskNode: Node = {
      uuid: task.name,
      type: 'task',
      name: task.name,
      // Prefer the joined task display name (label) if available
      label: task.label ?? task.name,
      layer_index: task.layer_index ?? null,
      description: task.description,
      is_unique: task.is_unique,
      concurrency: task.concurrency,
      service_name: task.service_name ?? null,
      // Backwards-compatible single-field (first predecessor or null)
      previousTaskExecutionName: (predecessors && predecessors.length > 0) ? predecessors[0] : null,
      // Preferred shape for FlowMap: allow multiple previous executions
      previousExecutions: predecessors.map((p: string) => ({ previousTaskExecutionId: p, previousTaskName: p })),
      
    };

  // Ensure previousExecutions exists
  taskNode.previousExecutions = taskNode.previousExecutions || [];
  // For debugging: store emitted/consumed signal arrays on the task node
  (taskNode as any).emittedSignals = [];
  (taskNode as any).consumedSignals = [];

  nodes.push(taskNode);
  console.debug('[staticTasksInRoutine] pushed task node:', taskNode.uuid, 'label:', taskNode.label);

  // Fetch signals emitted by this task (task -> signal)
    const emitted = await getSignalsEmittedByTask(task.name, task.label, task.service_name);
    // Fetch signals consumed by this task (signal -> task)
    const consumed = await getSignalsConsumedByTask(task.name, task.label, task.service_name);

    // If we found nothing via exact/fallback mapping, try a conservative
    // service-based candidate lookup to surface possible signals. These are
    // candidate matches (not exact) and will be marked so the UI can treat
    // them differently. This helps when mapping tables store verbose
    // descriptions (e.g. "Transmission of signal: IotDbService.telemetry.inserted").
    async function getCandidateSignalsByService(serviceName?: string) {
      if (!serviceName) return [];
      const likeServiceDot = `%${serviceName}.%`;
      try {
        const bySignalQ = `
          SELECT DISTINCT stm.signal_name, stm.signal_service_name AS service_name
          FROM signal_to_task_map stm
          JOIN signal_registry sr ON sr.name = stm.signal_name
          WHERE (stm.task_service_name = $1 OR stm.signal_service_name = $1 OR stm.task_name ILIKE $2)
            AND sr.is_meta = false
          LIMIT 200
        `;
        console.debug('[staticTasksInRoutine] getCandidateSignalsByService - signal_to_task_map query:', bySignalQ.replace(/\s+/g, ' ').trim(), 'params:', serviceName, likeServiceDot);
        const r1 = await client!.query(bySignalQ, [serviceName, likeServiceDot]);
        // Also try task_to_signal_map service_name match (if present)
        const byTaskQ = `
          SELECT DISTINCT tsm.signal_name, COALESCE(tsm.service_name, sr.service_name) AS service_name
          FROM task_to_signal_map tsm
          JOIN signal_registry sr ON sr.name = tsm.signal_name
          WHERE tsm.service_name = $1 AND sr.is_meta = false
          LIMIT 200
        `;
        console.debug('[staticTasksInRoutine] getCandidateSignalsByService - task_to_signal_map query:', byTaskQ.replace(/\s+/g, ' ').trim(), 'params:', serviceName);
        let r2 = { rows: [] as any[] } as any;
        try { r2 = await client!.query(byTaskQ, [serviceName]); } catch (e) { /* ignore if table/column absent */ }
        const combined = [...r1.rows, ...r2.rows];
        // Deduplicate by signal_name
        const seen = new Set<string>();
        const dedup: any[] = [];
        combined.forEach((row: any) => {
          if (!row || !row.signal_name) return;
          if (!seen.has(row.signal_name)) {
            seen.add(row.signal_name);
            dedup.push(row);
          }
        });
        console.debug('[staticTasksInRoutine] getCandidateSignalsByService - combined rows:', dedup.length, dedup.slice(0,5));
        return dedup;
      } catch (err) {
        console.error('[staticTasksInRoutine] getCandidateSignalsByService - error:', err);
        return [];
      }
    }

    if (debug) {
      diagnostics[task.name] = {
        predecessors,
        emittedRows: emitted.slice(0, 200),
        consumedRows: consumed.slice(0, 200),
      };
    }

    // If nothing matched, try candidate lookup by service (or an inferred
    // service name found inside the task name) and attach candidate signals
    // (marked) so the UI can show them as suggestions.
    if (emitted.length === 0 && consumed.length === 0) {
      // Try to infer a service name from the task name if present, e.g.
      // 'query health_metrics in IotDbService' -> 'IotDbService'
      let inferredService: string | null = null;
      try {
        const inMatch = (task.name || '').match(/in\s+([A-Za-z0-9_\.]+)/i);
        if (inMatch && inMatch[1]) inferredService = inMatch[1];
        else {
          const svcMatch = (task.name || '').match(/([A-Z][a-zA-Z0-9_]*Service)/);
          if (svcMatch && svcMatch[1]) inferredService = svcMatch[1];
        }
      } catch (e) {
        inferredService = null;
      }
      const candidateService = inferredService || task.service_name;
      if (candidateService) {
        if (debug) diagnostics[task.name] = { ...(diagnostics[task.name] || {}), candidateService };
      try {
        const candidates = await getCandidateSignalsByService(candidateService);
        if (debug && (!diagnostics[task.name])) diagnostics[task.name] = { predecessors };
        if (debug) diagnostics[task.name].candidateRows = candidates.slice(0,200);
        if (candidates && candidates.length > 0) {
          (taskNode as any).candidateSignals = [];
          candidates.forEach((s: any) => {
            const signalId = `signal::${s.signal_name}`;
            if (!signalMap.has(signalId)) {
              const sigNode: Node = {
                uuid: signalId,
                type: 'signal',
                name: signalId,
                label: s.signal_name,
                layer_index: null,
                metadata: { candidate: true },
                signal: true,
              } as any;
              (sigNode as any).previousExecutions = [];
              signalMap.set(signalId, sigNode);
            }
            const sigRef = signalMap.get(signalId) as any;
            // Mark the relation as candidate; attach as a predecessor (signal -> task)
            (sigRef as any).metadata = { ...(sigRef as any).metadata, candidate: true };
            (taskNode as any).previousExecutions.push({ previousTaskExecutionId: signalId, previousTaskName: s.signal_name, candidate: true });
            (taskNode as any).candidateSignals.push(s.signal_name);
            console.debug('[staticTasksInRoutine] registered candidate signal:', signalId, 'for task:', task.name);
          });
          if (debug) diagnostics[task.name].candidateRows = candidates.slice(0,200);
        }
      } catch (err) {
        console.error('[staticTasksInRoutine] candidate lookup failed for service:', task.service_name, err);
      }
      }
    }

    // Add emitted signals as separate nodes
    emitted.forEach((s: any) => {
      // Use a global signal id so multiple tasks emitting/consuming the same
      // signal map to the same node (signal::<signal_name>)
      const signalId = `signal::${s.signal_name}`;
      // Create or update the global signal node
      if (!signalMap.has(signalId)) {
        const sigNode: Node = {
          uuid: signalId,
          type: 'signal',
          name: signalId,
          label: s.signal_name,
          layer_index: null,
          relation: 'emitted_by',
          service_name: s.service_name ?? null,
          signal: true,
        } as any;
        // predecessor tasks will be stored on signal.previousExecutions
        (sigNode as any).previousExecutions = [];
        signalMap.set(signalId, sigNode);
      }
      // Add the emitting task as a predecessor of the signal node (task -> signal)
      const sigNodeRef = signalMap.get(signalId) as any;
      sigNodeRef.previousExecutions.push({ previousTaskExecutionId: task.name, previousTaskName: task.name });
      (taskNode as any).emittedSignals.push(s.signal_name);
      console.debug('[staticTasksInRoutine] registered emitted signal:', signalId, 'from task:', task.name);
    });

    // Add consumed signals as separate nodes
    consumed.forEach((s: any) => {
      const signalId = `signal::${s.signal_name}`;
      if (!signalMap.has(signalId)) {
        const sigNode: Node = {
          uuid: signalId,
          type: 'signal',
          name: signalId,
          label: s.signal_name,
          layer_index: null,
          metadata: {
            relation: 'consumed_by',
            service_name: s.service_name ?? null,
          },
          signal: true,
        } as any;
        (sigNode as any).previousExecutions = [];
        signalMap.set(signalId, sigNode);
      }
      // For consumed signals, the signal should be a predecessor of the task
      // (signal -> task). Add the signal as a predecessor entry on the taskNode.
      (taskNode as any).previousExecutions.push({ previousTaskExecutionId: signalId, previousTaskName: s.signal_name });
      (taskNode as any).consumedSignals.push(s.signal_name);
      console.debug('[staticTasksInRoutine] registered consumed signal:', signalId, 'for task:', task.name);
    });
  }));

  // Append unique signal nodes after processing tasks
  for (const sig of signalMap.values()) {
    nodes.push(sig);
    console.debug('[staticTasksInRoutine] appended global signal node:', sig.uuid, 'label:', sig.label);
  }

  console.debug('[staticTasksInRoutine] getRoutineMap - total nodes:', nodes.length);
  // Optionally log a sample of nodes to inspect shapes (avoid huge logs)
  console.debug('[staticTasksInRoutine] sample nodes:', nodes.slice(0,20));
  if (debug) {
    return { nodes, diagnostics };
  }
  return nodes;
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  // Parse search params robustly so we can support debug flags in queries
  const rawUrl = event.node.req.url ?? '';
  const parsed = new URL(rawUrl, 'http://localhost');
  const routineName = parsed.searchParams.get('routineName') ?? parsed.searchParams.get('routine') ?? '';
  const debug = parsed.searchParams.get('debug') === '1' || parsed.searchParams.get('debug') === 'true';

  if (method === 'GET') {
    try {
      return await getRoutineMap(routineName ?? '', debug);
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
