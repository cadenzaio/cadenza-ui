import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getNonMetaServices() {
  const query = `
    SELECT *
    FROM service
    WHERE is_meta = false
    ORDER BY modified DESC
  `;

  const res = await client!.query(query);
  return res.rows;
}

async function getRoutinesForService(serviceName: string) {
  const query = `
    SELECT 
      name, 
      description, 
      service_name, 
      is_meta, 
      version, 
      created, 
      deleted
    FROM routine
    WHERE service_name = $1
      AND is_meta = false
    ORDER BY name ASC
  `;

  const res = await client!.query(query, [serviceName]);
  return res.rows;
}

async function getTasksForRoutine(routineName: string) {
  const query = `
    SELECT 
      t.name, 
      t.description, 
      t.service_name, 
      t.layer_index, 
      t.version, 
      t.created, 
      t.deleted
    FROM task_to_routine_map ttrm
    LEFT JOIN task t ON ttrm.task_name = t.name
    WHERE ttrm.routine_name = $1
      AND t.is_meta = false
    ORDER BY t.layer_index ASC, t.name ASC
  `;

  const res = await client!.query(query, [routineName]);
  return res.rows;
}

async function getTasksForService(serviceName: string) {
  const query = `
    SELECT 
      name, 
      description, 
      service_name, 
      layer_index, 
      version, 
      created, 
      deleted
    FROM task
    WHERE service_name = $1
      AND is_meta = false
    ORDER BY layer_index ASC, name ASC
  `;

  const res = await client!.query(query, [serviceName]);
  return res.rows;
}

export default defineEventHandler(async (event) => {
  if (!client) client = await initializeClient();

  const { method } = event.node.req;
  if (method !== 'GET') return;

  try {
    const services = await getNonMetaServices();
    const servicesWithTasks = await Promise.all(
      services.map(async (svc: any) => {
        const tasks = await getTasksForService(svc.name);
        return { ...svc, tasks };
      })
    );

    const nodes: any[] = [];
    const edges: any[] = [];

    const serviceNameToId: Record<string, string> = {};

    function serviceId(svc: any) {
      return svc.uuid || svc.name;
    }

    function routineId(routine: any, svc: any) {
      return routine.uuid || `${svc.name}:${routine.name}`;
    }

    for (const svc of servicesWithTasks) {
      const sId = serviceId(svc);
      serviceNameToId[svc.name] = sId;

      nodes.push({ id: sId, type: 'custom', nodeType: 'service', data: { label: svc.display_name || svc.name, isParent: true } });

      const tasks = Array.isArray(svc.tasks) ? svc.tasks : [];
      if (tasks.length > 0) {
        for (const task of tasks) {
          const tId = task.name ? `${sId}:${task.name}` : `${sId}:unnamed-task`;
          nodes.push({ id: tId, type: 'custom', nodeType: 'task', parentNode: sId, data: { label: task.name || task.description || tId, taskName: task.name, service_name: task.service_name ?? svc.name } });
          edges.push({ id: `e-${sId}-${tId}`, source: sId, target: tId });
        }
      }

      try {
        const taskNames = tasks.map((t: any) => t.name).filter(Boolean);
        if (taskNames.length > 0) {
          const tasksQ = `
          SELECT 
            name, 
            service_name, 
          signals FROM task WHERE name = ANY($1)`;
          const tasksRes = await client!.query(tasksQ, [taskNames]);

          const emittersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};
          const consumersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};

          (tasksRes.rows || []).forEach((t: any) => {
            const signals = t.signals || {};
            const emittedSignals = signals.emits || [];
            const observedSignals = signals.observed || [];

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
            const externalEmitQ = `
            SELECT 
              name, 
              service_name, 
              signals 
            FROM task 
            WHERE signals->'emits' ?| $1::text[]`;
            const externalEmitRes = await client!.query(externalEmitQ, [consumedSignals]);
            (externalEmitRes.rows || []).forEach((t: any) => {
              const signals = t.signals || {};
              const emittedSignals = signals.emits || [];
              emittedSignals.forEach((sigName: string) => {
                if (consumedSignals.includes(sigName)) {
                  if (!emittersMap[sigName]) emittersMap[sigName] = [];
                  if (!emittersMap[sigName].some((e: any) => e.task_name === t.name)) {
                    emittersMap[sigName].push({ task_name: t.name, service_name: t.service_name });
                  }
                }
              });
            });
          }

          const allSignals = Array.from(new Set([...Object.keys(emittersMap), ...Object.keys(consumersMap)]));
          if (allSignals.length > 0) {
            const regQ = `
            SELECT 
              name, 
              domain, 
              action, 
              is_meta,  
              created, 
              deleted 
            FROM signal_registry 
            WHERE name = ANY($1) AND is_meta = false`;
            const regRes = await client!.query(regQ, [allSignals]);
            const registryByName: Record<string, any> = {};
            (regRes.rows || []).forEach((r: any) => (registryByName[r.name] = r));

            for (const sig of allSignals) {
              const sigNodeId = `signal::${sig}`;
              const registry = registryByName[sig];
              const parentServiceName = registry?.service_name ?? null;
              let parentNodeId = sId;
              if (parentServiceName) {
                const svcMatch = servicesWithTasks.find((x: any) => x.name === parentServiceName);
                if (svcMatch) parentNodeId = serviceId(svcMatch);
              }

              if (!nodes.some((n) => n.id === sigNodeId)) nodes.push({ id: sigNodeId, type: 'custom', nodeType: 'signal', parentNode: parentNodeId, data: { label: sig, signal: true, service_name: parentServiceName ?? svc.name } });

              const emitters = emittersMap[sig] || [];
              for (const e of emitters) {
                const emittingTaskId = `${sId}:${e.task_name}`;
                if (nodes.some((n) => n.id === emittingTaskId)) {
                  edges.push({ id: `e-${emittingTaskId}-${sigNodeId}`, source: emittingTaskId, target: sigNodeId });
                } else if (e.service_name) {
                  const svcMatch = servicesWithTasks.find((x: any) => x.name === e.service_name);
                  if (svcMatch) edges.push({ id: `e-${serviceId(svcMatch)}-${sigNodeId}`, source: serviceId(svcMatch), target: sigNodeId, style: { display: 'none' } });
                  else edges.push({ id: `e-${sId}-${sigNodeId}`, source: sId, target: sigNodeId, style: { display: 'none' } });
                } else {
                  edges.push({ id: `e-${sId}-${sigNodeId}`, source: sId, target: sigNodeId, style: { display: 'none' } });
                }
              }

              const consumers = consumersMap[sig] || [];
              for (const c of consumers) {
                const consumingTaskId = `${sId}:${c.task_name}`;
                if (nodes.some((n) => n.id === consumingTaskId)) edges.push({ id: `e-${sigNodeId}-${consumingTaskId}`, source: sigNodeId, target: consumingTaskId });
                else if (c.service_name) {
                  const svcMatch = servicesWithTasks.find((x: any) => x.name === c.service_name);
                  if (svcMatch) edges.push({ id: `e-${sigNodeId}-${serviceId(svcMatch)}`, source: sigNodeId, target: serviceId(svcMatch), style: { display: 'none' } });
                  else edges.push({ id: `e-${sigNodeId}-${sId}`, source: sigNodeId, target: sId, style: { display: 'none' } });
                } else edges.push({ id: `e-${sigNodeId}-${sId}`, source: sigNodeId, target: sId, style: { display: 'none' } });
              }
            }
          }
        }
      } catch (sigErr) {
        console.error('Error fetching signals for service', svc.name, sigErr);
      }
    }

    try {
      const taskNodes = nodes.filter((n) => n.nodeType === 'task');
      const taskIndex: Record<string, string[]> = {};
      taskNodes.forEach((n: any) => {
        const t = n.data?.taskName;
        const svcName = n.data?.service_name ?? '';
        if (!t) return;
        const svcKey = `${svcName}::${t}`;
        if (!taskIndex[svcKey]) taskIndex[svcKey] = [];
        taskIndex[svcKey].push(n.id);
        const anyKey = `*::${t}`;
        if (!taskIndex[anyKey]) taskIndex[anyKey] = [];
        taskIndex[anyKey].push(n.id);
      });

      const allTaskNames = Array.from(new Set(taskNodes.map((n: any) => n.data?.taskName).filter(Boolean)));
      if (allTaskNames.length > 0) {
        const dtmQ = `
        SELECT 
          task_name, 
          predecessor_task_name, 
          task_version, 
          predecessor_task_version, 
          service_name, 
          predecessor_service_name, 
          execution_count, 
          last_executed, 
          deleted 
        FROM directional_task_graph_map 
        WHERE (task_name = ANY($1) OR predecessor_task_name = ANY($1)) AND deleted = false`;
        const dtmRes = await client!.query(dtmQ, [allTaskNames]);

        for (const row of (dtmRes.rows || [])) {
          const taskName = row.task_name;
          const predName = row.predecessor_task_name;
          const taskSvc = row.service_name;
          const predSvc = row.predecessor_service_name;
          const targetIds = taskIndex[`${taskSvc}::${taskName}`] || taskIndex[`*::${taskName}`] || [];
          const sourceIds = taskIndex[`${predSvc}::${predName}`] || taskIndex[`*::${predName}`] || [];

          if (sourceIds.length > 0 && targetIds.length > 0) {
            for (const src of sourceIds) {
              for (const tgt of targetIds) {
                const edgeId = `e-${src}-${tgt}`;
                if (!edges.some((e) => e.id === edgeId)) {
                  const srcNode = nodes.find((n) => n.id === src);
                  const tgtNode = nodes.find((n) => n.id === tgt);
                  const sameRoutine = srcNode?.parentNode && srcNode.parentNode === tgtNode?.parentNode;

                  edges.push({ id: edgeId, source: src, target: tgt });
                }
              }
            }
          } else {
            const srcServiceId = predSvc && serviceNameToId[predSvc] ? serviceNameToId[predSvc] : null;
            const tgtServiceId = taskSvc && serviceNameToId[taskSvc] ? serviceNameToId[taskSvc] : null;
            if (sourceIds.length === 0 && targetIds.length > 0 && srcServiceId) {
              for (const tgt of targetIds) {
                const edgeId = `e-${srcServiceId}-${tgt}`;
                if (!edges.some((e) => e.id === edgeId)) edges.push({ id: edgeId, source: srcServiceId, target: tgt, style: { display: 'none' } });
              }
            }
            if (targetIds.length === 0 && sourceIds.length > 0 && tgtServiceId) {
              for (const src of sourceIds) {
                const edgeId = `e-${src}-${tgtServiceId}`;
                if (!edges.some((e) => e.id === edgeId)) edges.push({ id: edgeId, source: src, target: tgtServiceId, style: { display: 'none' } });
              }
            }
          }
        }
      }
    } catch (dtmErr) {
      console.error('Error fetching directional task graph map:', dtmErr);
    }


    for (const edge of edges) {
      if (edge.style && edge.style.display === 'none') continue;
      const srcNode = nodes.find((n) => n.id === edge.source);
      const tgtNode = nodes.find((n) => n.id === edge.target);
      const srcType = srcNode?.nodeType ?? null;
      const tgtType = tgtNode?.nodeType ?? null;
      const visible =
        (srcType === 'task' && (tgtType === 'task' || tgtType === 'signal')) ||
        (srcType === 'signal' && tgtType === 'task');
      if (!visible) {
        edge.style = edge.style || {};
        edge.style.display = 'none';
      } else {
        if (edge.style && edge.style.display === 'none') {
          delete edge.style.display;
          if (Object.keys(edge.style).length === 0) delete edge.style;
        }
      }
    }

    return { nodes, edges };
  } catch (error) {
    console.error('Error fetching services with routines:', error);
    throw error;
  }
});
