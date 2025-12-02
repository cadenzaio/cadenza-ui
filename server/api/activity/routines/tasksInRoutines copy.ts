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

async function getSignalsConsumedByExecutionIds(taskExecutionIds: string[]) {
	if (!taskExecutionIds || taskExecutionIds.length === 0) return {};
	const q = `
		SELECT
			task_execution_id,
			signal_name
		FROM signal_consumption
		WHERE task_execution_id = ANY($1)
	`;
	const r = await client!.query(q, [taskExecutionIds]);
	const map: Record<string, string[]> = {};
	for (const row of r.rows) {
		const id = String(row.task_execution_id);
		map[id] = map[id] || [];
		if (row.signal_name && !map[id].includes(row.signal_name)) map[id].push(row.signal_name);
	}
	return map;
}

async function getSignalsEmittedByExecutionIds(taskExecutionIds: string[]) {
	if (!taskExecutionIds || taskExecutionIds.length === 0) return {};
	const q = `
		SELECT
			task_execution_id,
			signal_name
		FROM signal_emission
		WHERE task_execution_id = ANY($1)
	`;
	const r = await client!.query(q, [taskExecutionIds]);
	const map: Record<string, string[]> = {};
	for (const row of r.rows) {
		const id = String(row.task_execution_id);
		map[id] = map[id] || [];
		if (row.signal_name && !map[id].includes(row.signal_name)) map[id].push(row.signal_name);
	}
	return map;
}

// Fetch emissions for a set of task execution ids and group by signal_name.
// Signal emission rows include the emission UUID which is used by signal_consumption.signal_emission_id.
async function getEmittersForExecutionIds(taskExecutionIds: string[]) {
	if (!taskExecutionIds || taskExecutionIds.length === 0) return {};
	const q = `
		SELECT
			uuid,
			signal_name,
			task_execution_id,
			task_name,
			service_name,
			created
		FROM signal_emission
		WHERE task_execution_id = ANY($1)
	`;
	const r = await client!.query(q, [taskExecutionIds]);
	const map: Record<string, Array<{ emission_id?: string; task_execution_id: string; task_name?: string; service_name?: string; created?: any }>> = {};
	for (const row of r.rows) {
		const sig = row.signal_name;
		map[sig] = map[sig] || [];
		const entry = { emission_id: row.uuid || row.emission_id || null, task_execution_id: row.task_execution_id, task_name: row.task_name, service_name: row.service_name, created: row.created };
		if (!map[sig].some((e) => String(e.emission_id) === String(entry.emission_id))) map[sig].push(entry);
	}
	return map;
}

async function getConsumersForEmissionIds(emissionIds: string[]) {
	if (!emissionIds || emissionIds.length === 0) return {};
	const q = `
		SELECT
			uuid,
			signal_emission_id,
			task_execution_id,
			task_name,
			service_name,
			created,
			consumed_at
		FROM signal_consumption
		WHERE signal_emission_id = ANY($1)
	`;
	const r = await client!.query(q, [emissionIds]);
	const map: Record<string, Array<{ uuid?: string; signal_emission_id?: string; task_execution_id: string; task_name?: string; service_name?: string; created?: any }>> = {};
	for (const row of r.rows) {
		const eid = row.signal_emission_id;
		map[eid] = map[eid] || [];
		map[eid].push({ uuid: row.uuid, signal_emission_id: row.signal_emission_id, task_execution_id: row.task_execution_id, task_name: row.task_name, service_name: row.service_name, created: row.created });
	}
	return map;
}

async function getConsumersForSignals(signals: string[]) {
	if (!signals || signals.length === 0) return {};
	const q = `
		SELECT
			signal_name,
			task_execution_id,
			task_name,
			service_name,
			created
		FROM signal_consumption
		WHERE signal_name = ANY($1)
	`;
	const r = await client!.query(q, [signals]);
	const map: Record<string, Array<{ task_execution_id: string; task_name?: string; service_name?: string; created?: any }>> = {};
	for (const row of r.rows) {
		const sig = row.signal_name;
		map[sig] = map[sig] || [];
		const entry = { task_execution_id: row.task_execution_id, task_name: row.task_name, service_name: row.service_name, created: row.created };
		if (!map[sig].some((e) => String(e.task_execution_id) === String(entry.task_execution_id))) map[sig].push(entry);
	}
	return map;
}

async function getPredecessorsByExecutionId(executionId: string) {
	const q = `
		SELECT
			previous_task_execution_id
		FROM task_execution_map
		WHERE task_execution_id = $1
	`;
	const r = await client!.query(q, [executionId] as any);
	return r.rows || [];
}

async function getSuccessorsByExecutionId(executionId: string) {
	const q = `
		SELECT
			task_execution_id
		FROM task_execution_map
		WHERE previous_task_execution_id = $1
	`;
	const r = await client!.query(q, [executionId] as any);
	return r.rows || [];
}

// Batch predecessors/successors helpers
async function getPredecessorsByExecutionIds(executionIds: string[]) {
	if (!executionIds || executionIds.length === 0) return {};
	const q = `
		SELECT
			task_execution_id,
			previous_task_execution_id
		FROM task_execution_map
		WHERE task_execution_id = ANY($1)
	`;
	const r = await client!.query(q, [executionIds]);
	const map: Record<string, string[]> = {};
	for (const row of r.rows) {
		const id = String(row.task_execution_id);
		map[id] = map[id] || [];
		if (row.previous_task_execution_id) map[id].push(row.previous_task_execution_id);
	}
	// ensure uniqueness
	for (const k of Object.keys(map)) map[k] = Array.from(new Set(map[k]));
	return map;
}

async function getSuccessorsByExecutionIds(previousIds: string[]) {
	if (!previousIds || previousIds.length === 0) return {};
	const q = `
		SELECT
			previous_task_execution_id,
			task_execution_id
		FROM task_execution_map
		WHERE previous_task_execution_id = ANY($1)
	`;
	const r = await client!.query(q, [previousIds]);
	const map: Record<string, string[]> = {};
	for (const row of r.rows) {
		const pid = String(row.previous_task_execution_id);
		map[pid] = map[pid] || [];
		if (row.task_execution_id) map[pid].push(row.task_execution_id);
	}
	for (const k of Object.keys(map)) map[k] = Array.from(new Set(map[k]));
	return map;
}

async function getTaskExecutionIdsForRoutineExecutionId(routineExecutionId: string) {
	const q = `
		SELECT
			uuid
		FROM task_execution
		WHERE routine_execution_id = $1
	`;
    const r = await client!.query(q, [routineExecutionId] as any);
    return r.rows.map((row: any) => row.uuid);
}

export default defineEventHandler(async (event) => {
	await ensureClient();
	const query = getQuery(event) as Record<string, any>;
	let taskExecutionId = query.task_execution_id || query.taskExecutionId || query.uuid || null;
	let routineExecutionId = query.routine_execution_id || query.routineExecutionId || null;
	const debugFlag = (query.debug === '1' || query.debug === 'true');

	if (event.node.req.method === 'POST') {
		try {
			const body = await readBody(event) as any;
			taskExecutionId = taskExecutionId || body.task_execution_id || body.taskExecutionId || body.uuid || null;
			routineExecutionId = routineExecutionId || body.routine_execution_id || body.routineExecutionId || null;
		} catch (e) {
		}
	}

	if (!taskExecutionId && !routineExecutionId) {
		throw new Error('Missing required parameter: task_execution_id (or routine_execution_id)');
	}

	// If caller provided a routine_execution_id, get all task executions for that routine
	let initialExecutionIds: string[] | null = null;
	if (routineExecutionId) {
		initialExecutionIds = await getTaskExecutionIdsForRoutineExecutionId(routineExecutionId as string);
		if (!initialExecutionIds || initialExecutionIds.length === 0) {
			throw new Error('No task executions found for routine_execution_id');
		}
	}

	const maxNodes = 1000;
	const toVisit: string[] = [];
	const visited = new Set<string>();
	const itemsMap: Record<string, { name?: string | null; version?: string | null; service?: string | null }> = {};

	if (initialExecutionIds) {
		initialExecutionIds.forEach((id) => {
			toVisit.push(id);
			itemsMap[id] = { name: null, version: null, service: null };
		});
	} else {
		toVisit.push(taskExecutionId as string);
		itemsMap[taskExecutionId as string] = { name: null, version: null, service: null };
	}

	const predecessorsMap: Record<string, string[]> = {};
	const successorsMap: Record<string, string[]> = {};

	// Process nodes in batches to reduce DB round-trips when fetching predecessors/successors
	const batchSize = 50;
	while (toVisit.length > 0 && visited.size < maxNodes) {
		const batch = toVisit.splice(0, batchSize).filter((id) => !!id && !visited.has(id)) as string[];
		if (batch.length === 0) continue;

		// mark visited
		batch.forEach((id) => visited.add(id));

		// fetch predecessors and successors for the whole batch
		let predsMap: Record<string, string[]> = {};
		let succsMap: Record<string, string[]> = {};
		try {
			predsMap = await getPredecessorsByExecutionIds(batch) as Record<string, string[]>;
		} catch (e) {
			predsMap = {};
		}
		try {
			succsMap = await getSuccessorsByExecutionIds(batch) as Record<string, string[]>;
		} catch (e) {
			succsMap = {};
		}

		for (const cur of batch) {
			const predIds = Array.from(new Set((predsMap[cur] || []).filter(Boolean)));
			predecessorsMap[cur] = predIds;
			predIds.forEach((pid) => {
				if (!itemsMap[pid]) itemsMap[pid] = { name: null, version: null, service: null };
				if (!visited.has(pid) && !toVisit.includes(pid)) toVisit.push(pid);
			});

			const succIds = Array.from(new Set((succsMap[cur] || []).filter(Boolean)));
			successorsMap[cur] = succIds;
			succIds.forEach((sid) => {
				if (!itemsMap[sid]) itemsMap[sid] = { name: null, version: null, service: null };
				if (!visited.has(sid) && !toVisit.includes(sid)) toVisit.push(sid);
			});
		}
	}

	const items = Object.keys(itemsMap).filter((k) => visited.has(k)).map((k) => ({ id: k, name: itemsMap[k].name ?? null, version: itemsMap[k].version ?? null, service: itemsMap[k].service }));

	// Build predecessorIdsMap from traversal results and batch-fetch consumed/emitted signals and their emitter/consumer relationships
	const predecessorIdsMap: Record<string, string[]> = {};
	items.forEach((it) => {
		predecessorIdsMap[it.id] = Array.from(new Set((predecessorsMap[it.id] || []).filter(Boolean)));
	});

	const itemIds = items.map((it) => it.id);
	const consumedSignalsMap: Record<string, string[]> = await getSignalsConsumedByExecutionIds(itemIds);
	const emittedSignalsMap: Record<string, string[]> = await getSignalsEmittedByExecutionIds(itemIds);

	// Build list of signals we need emission records for (both consumed and emitted signals)
	const allConsumedSignals = Array.from(new Set(Object.values(consumedSignalsMap).flat()));
	const allEmittedSignals = Array.from(new Set(Object.values(emittedSignalsMap).flat()));
	const signalsToFetchEmitters = Array.from(new Set([...allConsumedSignals, ...allEmittedSignals]));

	// Fetch emissions for the task execution ids we're displaying (includes emission uuid as emission_id)
	const emittersMap = await getEmittersForExecutionIds(itemIds);

	// Collect all emission ids, then fetch consumers by emission id to get exact consumptions
	const allEmissionIds = Array.from(new Set(Object.values(emittersMap).flat().map((e: any) => e.emission_id).filter(Boolean)));
	const consumersByEmissionId = await getConsumersForEmissionIds(allEmissionIds);

	// Build consumersMap keyed by signal name by mapping emissions -> their consumers
	const consumersMap: Record<string, Array<any>> = {};
	for (const sig of Object.keys(emittersMap)) {
		consumersMap[sig] = [];
		for (const emission of emittersMap[sig]) {
			const eid = String(emission.emission_id || '');
			const consumersForEmission = (consumersByEmissionId && consumersByEmissionId[eid]) ? consumersByEmissionId[eid] : [];
			for (const c of consumersForEmission) {
				consumersMap[sig].push(c);
			}
		}
	}

	// Build helper maps: emissionId -> signalName, and taskExecutionId -> emissionIds it consumes
	const emissionToSignal: Record<string, string> = {};
	const emissionEntryById: Record<string, any> = {};
	for (const sig of Object.keys(emittersMap)) {
		for (const emission of emittersMap[sig]) {
			if (emission && emission.emission_id) {
				emissionToSignal[String(emission.emission_id)] = sig;
				emissionEntryById[String(emission.emission_id)] = emission;
			}
		}
	}

	const consumerEmissionsMap: Record<string, string[]> = {};
	for (const eid of Object.keys(consumersByEmissionId || {})) {
		const consumersFor = consumersByEmissionId[eid] || [];
		for (const c of consumersFor) {
			const tid = String(c.task_execution_id);
			consumerEmissionsMap[tid] = consumerEmissionsMap[tid] || [];
			if (!consumerEmissionsMap[tid].includes(eid)) consumerEmissionsMap[tid].push(eid);
		}
	}


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
				created: det ? det.created : null,
				ended: det ? det.ended : null,
				previousExecution,
				previousExecutions,
			};
		} catch (e) {
			return { id: it.id, name: it.name, version: it.version ?? null, service: it.service ?? null, execution_trace_id: null, executionTraceId: null, created: null, ended: null, previousExecution, previousExecutions };
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
					created: it.created ?? null,
					ended: it.ended ?? null,
					previousTaskExecutionName: null,
				});

				const emitted = emittedSignalsMap[it.id] ?? [];
				for (const sig of emitted) {
					// find emissions for this signal that were emitted by this task execution
					const emissionsForSig = (emittersMap[sig] || []).filter((e: any) => String(e.task_execution_id) === String(it.id));
					if (emissionsForSig.length === 0) {
						// fallback to signal-name node if no emission rows exist for this task
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
								created: (emittersMap[sig] && emittersMap[sig][0] && emittersMap[sig][0].created) ? emittersMap[sig][0].created : ((consumersMap[sig] && consumersMap[sig][0] && consumersMap[sig][0].created) ? consumersMap[sig][0].created : null),
								ended: (emittersMap[sig] && emittersMap[sig][0] && emittersMap[sig][0].created) ? emittersMap[sig][0].created : ((consumersMap[sig] && consumersMap[sig][0] && consumersMap[sig][0].created) ? consumersMap[sig][0].created : null),
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
								created: detC ? detC.created : null,
								ended: detC ? detC.ended : null,
								previousTaskExecutionName: `signal::${sig}`,
							});
						}
					} else {
						// create a signal node per emission
						for (const emission of emissionsForSig) {
							const eid = String(emission.emission_id || '');
							if (!eid) continue;
							const signalId = `signal::${eid}`;
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
									service_name: emission.service_name ?? null,
									created: emission.created ?? null,
									ended: emission.created ?? null,
									relation: 'emitted_by'
								});
							}

							// consumers specific to this emission
							const consumers = (consumersByEmissionId && consumersByEmissionId[eid]) ? consumersByEmissionId[eid].filter((c: any) => visited.has(String(c.task_execution_id))) : [];
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
									created: detC ? detC.created : null,
									ended: detC ? detC.ended : null,
									previousTaskExecutionName: signalId,
								});
							}
						}
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
							created: (consumersMap[csig] && consumersMap[csig][0] && consumersMap[csig][0].created) ? consumersMap[csig][0].created : null,
							ended: (consumersMap[csig] && consumersMap[csig][0] && consumersMap[csig][0].created) ? consumersMap[csig][0].created : null,
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
					created: it.created ?? null,
					ended: it.ended ?? null,
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
							created: (emittersMap[sig] && emittersMap[sig][0] && emittersMap[sig][0].created) ? emittersMap[sig][0].created : ((consumersMap[sig] && consumersMap[sig][0] && consumersMap[sig][0].created) ? consumersMap[sig][0].created : null),
							ended: (emittersMap[sig] && emittersMap[sig][0] && emittersMap[sig][0].created) ? emittersMap[sig][0].created : ((consumersMap[sig] && consumersMap[sig][0] && consumersMap[sig][0].created) ? consumersMap[sig][0].created : null),
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
						created: it.created ?? null,
						ended: it.ended ?? null,
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
					created: it.created ?? null,
					ended: it.ended ?? null,
					previousTaskExecutionName: p ?? null,
				});
			}
		});

	}

	// Ensure compatibility with FlowMap: provide `previousTaskExecutionId`
	// by copying whatever is in `previousTaskExecutionName` (could be null, task uuid or signal id)
	for (const n of outputNodes) {
		if (n.previousTaskExecutionId === undefined) {
			n.previousTaskExecutionId = n.previousTaskExecutionName ?? null;
		}
	}

	// Sort output nodes by `created` timestamp (newest first). Nodes without `created` go last.
	outputNodes.sort((a: any, b: any) => {
		const ta = a && a.created ? new Date(a.created).getTime() : -Infinity;
		const tb = b && b.created ? new Date(b.created).getTime() : -Infinity;
		return tb - ta;
	});

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

