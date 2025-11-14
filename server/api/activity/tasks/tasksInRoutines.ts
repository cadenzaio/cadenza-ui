import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery, readBody } from 'h3';

let client: pg.Client | null = null;

async function ensureClient() {
	if (!client) {
		client = await initializeClient();
	}
}

async function getTaskDetailsByExecutionId(executionId: string) {
	// Fetch the task execution row by its UUID. 
	const q = `
		SELECT
			task_name AS name,
			NULL AS description,
			NULL AS layer_index,
			NULL AS is_unique,
			NULL AS concurrency,
			service_name,
			task_version AS version,
			uuid,
			routine_execution_id,
			context_id,
			result_context_id,
			service_instance_id,
			execution_trace_id,
			is_scheduled,
			is_running,
			is_complete,
			is_meta,
			errored,
			failed,
			reached_timeout,
			error_message,
			progress,
			created,
			started,
			ended
		FROM task_execution
		WHERE uuid = $1
		LIMIT 1
	`;
	const r = await client!.query(q, [executionId] as any);
	return r.rows[0] ?? null;
}

async function getLatestExecutionIdForTaskName(taskName: string) {
	const q = `
		SELECT uuid FROM task_execution
		WHERE task_name = $1
		ORDER BY started DESC NULLS LAST
		LIMIT 1
	`;
	const r = await client!.query(q, [taskName] as any);
	return r.rows[0] ? r.rows[0].uuid : null;
}

async function getSignalsConsumedByExecutionId(taskExecutionId: string) {
	const q = `
		SELECT DISTINCT signal_name, service_name
		FROM signal_consumption
		WHERE task_execution_id = $1
	`;
	const r = await client!.query(q, [taskExecutionId]);
	return r.rows; 
}

async function getEmittersForSignal(signalName: string) {
	const q = `
		SELECT DISTINCT task_execution_id, task_name, service_name
		FROM signal_emission
		WHERE signal_name = $1
	`;
	const r = await client!.query(q, [signalName]);
	return r.rows; 
}

async function getSignalsEmittedByExecutionId(taskExecutionId: string) {
	const q = `
		SELECT DISTINCT signal_name
		FROM signal_emission
		WHERE task_execution_id = $1
	`;
	const r = await client!.query(q, [taskExecutionId]);
	return r.rows.map((r: any) => r.signal_name);
}

async function getConsumersForSignal(signalName: string) {
	const q = `
		SELECT DISTINCT task_execution_id, task_name, service_name
		FROM signal_consumption
		WHERE signal_name = $1
	`;
	const r = await client!.query(q, [signalName]);
	return r.rows; 
}

async function getPredecessorsByExecutionId(executionId: string) {
	const q = `SELECT previous_task_execution_id FROM task_execution_map WHERE task_execution_id = $1`;
	const r = await client!.query(q, [executionId] as any);
	return r.rows || [];
}

async function getSuccessorsByExecutionId(executionId: string) {
	const q = `SELECT task_execution_id FROM task_execution_map WHERE previous_task_execution_id = $1`;
	const r = await client!.query(q, [executionId] as any);
	return r.rows || [];
}

export default defineEventHandler(async (event) => {
	await ensureClient();
	const query = getQuery(event) as Record<string, any>;
	let taskExecutionId = query.task_execution_id || query.taskExecutionId || query.uuid || null;
	let taskName = query.task_name || query.taskName || query.name || null;
	const debugFlag = (query.debug === '1' || query.debug === 'true');

	if (event.node.req.method === 'POST') {
		try {
			const body = await readBody(event) as any;
			taskExecutionId = taskExecutionId || body.task_execution_id || body.taskExecutionId || body.uuid || null;
			taskName = taskName || body.task_name || body.taskName || body.name || null;
		} catch (e) {
		}
	}

	if (!taskExecutionId && !taskName) {
		throw new Error('Missing required parameter: task_execution_id (or task_name / taskName / name)');
	}

	if (!taskExecutionId && taskName) {
		try { taskName = decodeURIComponent((taskName as string).replace(/\+/g, ' ')); } catch (e) { /* ignore */ }
		taskExecutionId = await getLatestExecutionIdForTaskName(taskName as string);
		if (!taskExecutionId) throw new Error('No task execution found for task_name');
	}

	const maxNodes = 1000;
	const toVisit: string[] = [taskExecutionId as string];
	const visited = new Set<string>();
	const itemsMap: Record<string, { name?: string | null; version?: string | null; service?: string | null }> = {};
	itemsMap[taskExecutionId as string] = { name: taskName as string ?? null, version: null, service: null };

	const predecessorsMap: Record<string, string[]> = {};
	const successorsMap: Record<string, string[]> = {};

	while (toVisit.length > 0 && visited.size < maxNodes) {
		const cur = toVisit.shift() as string;
		if (!cur || visited.has(cur)) continue;
		visited.add(cur);

		try {
			const preds = await getPredecessorsByExecutionId(cur);
			const predIds = Array.from(new Set((preds || []).map((p: any) => p.previous_task_execution_id).filter(Boolean)));
			predecessorsMap[cur] = predIds;
			predIds.forEach((pid) => {
				if (!itemsMap[pid]) itemsMap[pid] = { name: null, version: null, service: null };
				if (!visited.has(pid) && !toVisit.includes(pid)) toVisit.push(pid);
			});
		} catch (e) {
			predecessorsMap[cur] = predecessorsMap[cur] || [];
		}

		try {
			const succs = await getSuccessorsByExecutionId(cur);
			const succIds = Array.from(new Set((succs || []).map((s: any) => s.task_execution_id).filter(Boolean)));
			successorsMap[cur] = succIds;
			succIds.forEach((sid) => {
				if (!itemsMap[sid]) itemsMap[sid] = { name: null, version: null, service: null };
				if (!visited.has(sid) && !toVisit.includes(sid)) toVisit.push(sid);
			});
		} catch (e) {
			successorsMap[cur] = successorsMap[cur] || [];
		}
	}

	const items = Object.keys(itemsMap).filter((k) => visited.has(k)).map((k) => ({ id: k, name: itemsMap[k].name ?? null, version: itemsMap[k].version ?? null, service: itemsMap[k].service }));

	const predecessorIdsMap: Record<string, string[]> = {};
	const consumedSignalsMap: Record<string, string[]> = {};
	await Promise.all(items.map(async (it) => {
		try {
			const preds = await getPredecessorsByExecutionId(it.id);
			predecessorIdsMap[it.id] = Array.from(new Set((preds || []).map((p: any) => p.previous_task_execution_id).filter(Boolean)));
		} catch (e) {
			predecessorIdsMap[it.id] = [];
		}

		try {
			const consumed = await getSignalsConsumedByExecutionId(it.id);
			consumedSignalsMap[it.id] = Array.from(new Set((consumed || []).map((c: any) => c.signal_name).filter(Boolean)));
		} catch (e) {
			consumedSignalsMap[it.id] = [];
		}
	}));

	
	const allSignals = Array.from(new Set(Object.values(consumedSignalsMap).flat()));
	const emittersMap: Record<string, Array<{ task_execution_id: string; task_name?: string; service_name?: string }>> = {};
	await Promise.all(allSignals.map(async (s) => {
		try {
			const emitters = await getEmittersForSignal(s);
			emittersMap[s] = Array.from(new Map((emitters || []).map((e: any) => [String(e.task_execution_id), { task_execution_id: e.task_execution_id, task_name: e.task_name, service_name: e.service_name }])).values());
		} catch (e) {
			emittersMap[s] = [];
		}
	}));

	const emittedSignalsMap: Record<string, string[]> = {};
	await Promise.all(items.map(async (it) => {
		try {
			emittedSignalsMap[it.id] = await getSignalsEmittedByExecutionId(it.id) || [];
		} catch (e) {
			emittedSignalsMap[it.id] = [];
		}
	}));

	const allEmittedSignals = Array.from(new Set(Object.values(emittedSignalsMap).flat()));

	const signalsToFetchConsumers = Array.from(new Set([...allEmittedSignals, ...allSignals]));
	const consumersMap: Record<string, Array<{ task_execution_id: string; task_name?: string; service_name?: string }>> = {};
	await Promise.all(signalsToFetchConsumers.map(async (s) => {
		try {
			const consumers = await getConsumersForSignal(s);
			consumersMap[s] = Array.from(new Map((consumers || []).map((c: any) => [String(c.task_execution_id), { task_execution_id: c.task_execution_id, task_name: c.task_name, service_name: c.service_name }])).values());
		} catch (e) {
			consumersMap[s] = [];
		}
	}));


	const enriched = await Promise.all(items.map(async (it) => {

		const prevList = predecessorIdsMap[it.id] ?? [];
		const previousExecution = prevList.length > 0 ? prevList[0] : null;
		const previousExecutions = prevList.length > 0 ? prevList : [];
		try {
			const det = await getTaskDetailsByExecutionId(it.id);
			return {
				id: it.id,
				name: det ? det.name : it.name,
				version: it.version ?? (det ? det.version : null),
				service: it.service ?? (det ? det.service_name : null),
				description: det ? det.description : null,
				layer_index: det ? det.layer_index : null,
				is_unique: det ? det.is_unique : null,
				concurrency: det ? det.concurrency : null,
				execution_trace_id: det ? det.execution_trace_id : null,
				executionTraceId: det ? det.execution_trace_id : null,
				previousExecution,
				previousExecutions,
			};
		} catch (e) {
			return { id: it.id, name: it.name, version: it.version ?? null, service: it.service ?? null, execution_trace_id: null, executionTraceId: null, previousExecution, previousExecutions };
		}
	}));

	const outputNodes: any[] = [];
	const pushedSignalIds = new Set<string>();

	for (const it of enriched) {
		const prevs: string[] = Array.isArray(it.previousExecutions) ? it.previousExecutions : [];
		if (!prevs || prevs.length === 0) {
				outputNodes.push({
					uuid: it.id,
					type: 'task',
					name: it.name,
					label: it.name,
					description: it.description ?? null,
					layer_index: it.layer_index ?? null,
					is_unique: it.is_unique ?? null,
					concurrency: it.concurrency ?? null,
					execution_trace_id: it.execution_trace_id ?? null,
					executionTraceId: it.executionTraceId ?? null,
					previousTaskExecutionName: null,
				});

				const emitted = emittedSignalsMap[it.id] ?? [];
				for (const sig of emitted) {
					const signalId = `signal::${sig}`;
					if (!pushedSignalIds.has(signalId)) {
						pushedSignalIds.add(signalId);
						outputNodes.push({
							uuid: signalId,
							type: 'signal',
							name: sig,
							label: sig,
							description: null,
							layer_index: null,
							is_unique: false,
							concurrency: null,
							previousTaskExecutionName: it.id,
							signal: true,
							service_name: (emittersMap[sig] && emittersMap[sig][0] && emittersMap[sig][0].service_name) ? emittersMap[sig][0].service_name : null,
							relation: 'emitted_by'
					});
					}

					const consumers = (consumersMap[sig] ?? []).filter((c: any) => visited.has(String(c.task_execution_id)));
					for (const c of consumers) {
						let detC = null;
						try {
							detC = await getTaskDetailsByExecutionId(c.task_execution_id);
						} catch (e) {
							detC = null;
						}
						outputNodes.push({
							uuid: c.task_execution_id,
							type: 'task',
							name: c.task_name,
							label: c.task_name,
							description: detC ? detC.description : null,
							layer_index: detC ? detC.layer_index : null,
							is_unique: detC ? detC.is_unique : false,
							concurrency: detC ? detC.concurrency : null,
							execution_trace_id: detC ? detC.execution_trace_id : null,
							executionTraceId: detC ? detC.execution_trace_id : null,
							previousTaskExecutionName: `signal::${sig}`,
						});
					}
				}

				const consumedByThis = consumedSignalsMap[it.id] ?? [];
				for (const csig of consumedByThis) {
					const signalId2 = `signal::${csig}`;
					if (!pushedSignalIds.has(signalId2)) {
						pushedSignalIds.add(signalId2);
						outputNodes.push({
							uuid: signalId2,
							type: 'signal',
							name: csig,
							label: csig,
							description: null,
							layer_index: null,
							is_unique: false,
							concurrency: null,
							previousTaskExecutionName: null,
							signal: true,
							service_name: null,
							relation: 'consumed_by'
						});
					}
					outputNodes.push({
						uuid: it.id,
						type: 'task',
						name: it.name,
						label: it.name,
						description: it.description ?? null,
						layer_index: it.layer_index ?? null,
						is_unique: it.is_unique ?? null,
						concurrency: it.concurrency ?? null,
						execution_trace_id: it.execution_trace_id ?? null,
						executionTraceId: it.executionTraceId ?? null,
						previousTaskExecutionName: `signal::${csig}`,
					});
				}

				continue;
			}

		const consumed = consumedSignalsMap[it.id] ?? [];

		prevs.forEach((p) => {
			const matchingSignals = consumed.filter((s: string) => Array.isArray(emittersMap[s]) && emittersMap[s].some((e: any) => String(e.task_execution_id) === String(p)));

			if (matchingSignals.length > 0) {
				matchingSignals.forEach((sig) => {
					const signalId = `signal::${sig}`;
					if (!pushedSignalIds.has(signalId)) {
						pushedSignalIds.add(signalId);
						outputNodes.push({
							uuid: signalId,
							type: 'signal',
							name: sig,
							label: sig,
							description: null,
							layer_index: null,
							is_unique: false,
							concurrency: null,
							previousTaskExecutionName: p,
							signal: true,
							service_name: (emittersMap[sig] && emittersMap[sig][0] && emittersMap[sig][0].service_name) ? emittersMap[sig][0].service_name : null,
							relation: 'emitted_by'
						});
					}
					outputNodes.push({
						uuid: it.id,
						type: 'task',
						name: it.name,
						label: it.name,
						description: it.description ?? null,
						layer_index: it.layer_index ?? null,
						is_unique: it.is_unique ?? null,
						concurrency: it.concurrency ?? null,
						execution_trace_id: it.execution_trace_id ?? null,
						executionTraceId: it.executionTraceId ?? null,
						previousTaskExecutionName: `signal::${sig}`,
					});
				});
			} else {
				outputNodes.push({
					uuid: it.id,
					type: 'task',
					name: it.name,
					label: it.name,
					description: it.description ?? null,
					layer_index: it.layer_index ?? null,
					is_unique: it.is_unique ?? null,
					concurrency: it.concurrency ?? null,
					execution_trace_id: it.execution_trace_id ?? null,
					executionTraceId: it.executionTraceId ?? null,
					previousTaskExecutionName: p ?? null,
				});
			}
		});

	}

	if (debugFlag) {
		return {
			nodes: outputNodes,
			diagnostics: {
				items,
				visited: Array.from(visited),
				predecessorIdsMap,
				consumedSignalsMap,
				emittersMap,
				emittedSignalsMap,
				consumersMap,
				successorsMap,
			},
		};
	}

	return outputNodes;
});

