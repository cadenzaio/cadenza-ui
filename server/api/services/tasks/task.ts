import { supabaseAdmin } from '~/utils/supabase';
import { getQuery, readBody } from 'h3';

async function getTaskDetails(name: string, version?: string | null, service?: string | null) {
	try {
		const { data, error } = await supabaseAdmin.rpc('get_task_details', {
			task_name_param: name,
			version_param: version || null,
			service_param: service || null
		});

		if (error) {
			throw error;
		}

		return data && data.length > 0 ? data[0] : null;
	} catch (error) {
		console.error('Error getting task details:', error);
		throw error;
	}
}

const queryRows = async (rpcName: string, params: any = {}) => {
	try {
		const { data, error } = await supabaseAdmin.rpc(rpcName, params);
		if (error) throw error;
		return data || [];
	} catch (error) {
		console.error(`Error executing RPC ${rpcName}:`, error);
		throw error;
	}
};

async function getRoutineForTaskName(taskName: string) {
	try {
		const data = await queryRows('get_routine_for_task_name', { task_name_param: taskName });
		return data && data.length > 0 ? data[0].routine_name : null;
	} catch (error) {
		console.error('Error getting routine for task:', error);
		return null;
	}
}

async function getSignalsConsumedByTaskName(taskName: string) {
	try {
		const data = await queryRows('get_signals_consumed_by_task', { task_name_param: taskName });
		return data || [];
	} catch (error) {
		console.error('Error getting signals consumed by task:', error);
		return [];
	}
}

async function getEmittersForSignal(signalName: string) {
	try {
		return await queryRows('get_signal_emitters', { signal_name_param: signalName });
	} catch (error) {
		console.error('Error getting signal emitters:', error);
		return [];
	}
}

async function getSignalsEmittedByTaskName(taskName: string) {
	try {
		const data = await queryRows('get_signals_emitted_by_task', { task_name_param: taskName });
		return data.map((row: any) => row.signal_name) || [];
	} catch (error) {
		console.error('Error getting signals emitted by task:', error);
		return [];
	}
}

async function getConsumersForSignal(signalName: string) {
	try {
		return await queryRows('get_signal_consumers', { signal_name_param: signalName });
	} catch (error) {
		console.error('Error getting signal consumers:', error);
		return [];
	}
}

async function getPredecessors(name: string, version?: string | null, service?: string | null) {
	try {
		return await queryRows('get_task_predecessors', {
			task_name_param: name,
			version_param: version || null,
			service_param: service || null
		}) || [];
	} catch (error) {
		console.error('Error getting task predecessors:', error);
		return [];
	}
}

async function getSuccessors(name: string, version?: string | null, service?: string | null) {
	try {
		return await queryRows('get_task_successors', {
			task_name_param: name,
			version_param: version || null,
			service_param: service || null
		}) || [];
	} catch (error) {
		console.error('Error getting task successors:', error);
		return [];
	}
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event) as Record<string, any>;
	let taskName = query.task_name || query.taskName || query.name || null;
	let version = query.version || query.task_version || null;
	let service = query.service || query.serviceName || query.service_name || null;
	const debugFlag = query.debug === '1' || query.debug === 'true';

	if (event.node.req.method === 'POST') {
		try {
			const body = (await readBody(event)) as any;
			taskName = taskName || body.task_name || body.taskName || body.name;
			version = version || body.version || body.task_version || null;
			service = service || body.service || body.serviceName || body.service_name || null;
		} catch (e) {
		}
	}

	if (!taskName) throw new Error('Missing required parameter: task_name (or taskName / name)');
	try { taskName = decodeURIComponent((taskName as string).replace(/\+/g, ' ')); } catch (e) { /* ignore */ }

	const maxNodes = 1000;
	const toVisit: string[] = [taskName as string];
	const visited = new Set<string>();
	const itemsMap: Record<string, { name: string; version?: string | null; service?: string | null }> = {};
	itemsMap[taskName as string] = { name: taskName as string, version: version ?? null, service };

	const predecessorsMap: Record<string, string[]> = {};
	const successorsMap: Record<string, string[]> = {};

	while (toVisit.length > 0 && visited.size < maxNodes) {
		const cur = toVisit.shift() as string;
		if (!cur || visited.has(cur)) continue;
		visited.add(cur);

		try {
			const preds = await getPredecessors(cur, version, service);
			const predNames: string[] = Array.from(new Set((preds || []).map((p: any) => p.predecessor_task_name as string).filter(Boolean)));
			predecessorsMap[cur] = predNames;
			predNames.forEach((pn) => {
				if (!itemsMap[pn]) itemsMap[pn] = { name: pn, version: null, service };
				if (!visited.has(pn) && !toVisit.includes(pn)) toVisit.push(pn);
			});
		} catch (e) {
			predecessorsMap[cur] = predecessorsMap[cur] || [];
		}

		try {
			const succs = await getSuccessors(cur, version, service);
			const succNames: string[] = Array.from(new Set((succs || []).map((s: any) => s.task_name).filter(Boolean)));
			successorsMap[cur] = succNames;
			succNames.forEach((sn) => {
				if (!itemsMap[sn]) itemsMap[sn] = { name: sn, version: null, service };
				if (!visited.has(sn) && !toVisit.includes(sn)) toVisit.push(sn);
			});
		} catch (e) {
			successorsMap[cur] = successorsMap[cur] || [];
		}
	}

	const items = Object.keys(itemsMap).filter((k) => visited.has(k)).map((k) => ({ name: k, version: itemsMap[k].version ?? null, service: itemsMap[k].service }));

	const predecessorNamesMap: Record<string, string[]> = {};
	const consumedSignalsMap: Record<string, string[]> = {};
	await Promise.all(items.map(async (it) => {
		try {
			const preds = await getPredecessors(it.name, it.version, it.service);
			predecessorNamesMap[it.name] = Array.from(new Set((preds || []).map((p: any) => p.predecessor_task_name).filter(Boolean)));
		} catch (e) {
			predecessorNamesMap[it.name] = [];
		}

		try {
			const consumed = await getSignalsConsumedByTaskName(it.name);
			consumedSignalsMap[it.name] = Array.from(new Set((consumed || []).map((c: any) => c.signal_name).filter(Boolean)));
		} catch (e) {
			consumedSignalsMap[it.name] = [];
		}
	}));

	const allSignals = Array.from(new Set(Object.values(consumedSignalsMap).flat()));
	const emittersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};
	await Promise.all(allSignals.map(async (s) => {
        try {
            const emitters = await getEmittersForSignal(s) as Array<{ task_name: string; service_name?: string }>;
            emittersMap[s] = Array.from(new Map(emitters.map((e) => [String(e.task_name), { task_name: e.task_name, service_name: e.service_name }])).values());
        } catch (e) {
            emittersMap[s] = [];
        }
    }));

	const emittedSignalsMap: Record<string, string[]> = {};
	await Promise.all(items.map(async (it) => {
		try {
			emittedSignalsMap[it.name] = await getSignalsEmittedByTaskName(it.name) || [];
		} catch (e) {
			emittedSignalsMap[it.name] = [];
		}
	}));

	const allEmittedSignals = Array.from(new Set(Object.values(emittedSignalsMap).flat()));
	const signalsToFetchConsumers = Array.from(new Set([...allEmittedSignals, ...allSignals]));
	const consumersMap: Record<string, Array<{ task_name: string; service_name?: string }> > = {};
	await Promise.all(signalsToFetchConsumers.map(async (s) => {
		try {
			const consumers = await getConsumersForSignal(s) as Array<{ task_name: string; service_name?: string }>;
			consumersMap[s] = Array.from(new Map((consumers || []).map((c: any) => [String(c.task_name), { task_name: c.task_name, service_name: c.service_name }])).values());
		} catch (e) {
			consumersMap[s] = [];
		}
	}));

	const enriched = await Promise.all(items.map(async (it) => {
		const prevList = predecessorNamesMap[it.name] ?? [];
		const previousExecution = prevList.length > 0 ? prevList[0] : null;
		const previousExecutions = prevList.length > 0 ? prevList : [];
		try {
			const det = await getTaskDetails(it.name, it.version, it.service);
			const routineName = await getRoutineForTaskName(it.name);
			return {
				name: it.name,
				version: it.version ?? (det ? det.version : null),
				service: it.service ?? (det ? det.service_name : null),
				routine_name: routineName,
				description: det ? det.description : null,
				layer_index: det ? det.layer_index : null,
				is_unique: det ? det.is_unique : null,
				concurrency: det ? det.concurrency : null,
				previousExecution,
				previousExecutions,
			};
		} catch (e) {
			const routineName = await getRoutineForTaskName(it.name).catch(() => null);
			return { name: it.name, version: it.version ?? null, service: it.service ?? null, routine_name: routineName, previousExecution, previousExecutions };
		}
	}));

	const outputNodes: any[] = [];
	const pushedSignalIds = new Set<string>();

	for (const it of enriched) {
		const prevs: string[] = Array.isArray(it.previousExecutions) ? it.previousExecutions : [];

		if (!prevs || prevs.length === 0) {
			outputNodes.push({
				uuid: it.name,
				type: 'task',
				name: it.name,
				label: it.name,
				description: it.description ?? null,
				layer_index: it.layer_index ?? null,
				is_unique: it.is_unique ?? null,
				concurrency: it.concurrency ?? null,
				routine_name: it.routine_name ?? null,
				service_name: it.service ?? null,
				previousTaskExecutionName: null,
			});

			const emitted = emittedSignalsMap[it.name] ?? [];
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
						previousTaskExecutionName: it.name,
						signal: true,
						service_name: (emittersMap[sig] && emittersMap[sig][0] && emittersMap[sig][0].service_name) ? emittersMap[sig][0].service_name : null,
						relation: 'emitted_by',
					});
				}

				const consumers = consumersMap[sig] ?? [];
				for (const c of consumers) {
					let detC = null;
					try {
						detC = await getTaskDetails(c.task_name, null, c.service_name);
					} catch (e) { detC = null; }
					const detCRoutine = await getRoutineForTaskName(c.task_name).catch(() => null);
					outputNodes.push({
						uuid: c.task_name,
						type: 'task',
						name: c.task_name,
						label: c.task_name,
						description: detC ? detC.description : null,
						layer_index: detC ? detC.layer_index : null,
						is_unique: detC ? detC.is_unique : false,
						concurrency: detC ? detC.concurrency : null,
						routine_name: detCRoutine ?? null,
						service_name: detC ? detC.service_name : c.service_name ?? null,
						previousTaskExecutionName: sig,
					});
				}
			}

			const consumedByThis = consumedSignalsMap[it.name] ?? [];
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
						relation: 'consumed_by',
					});
				}
				outputNodes.push({
					uuid: it.name,
					type: 'task',
					name: it.name,
					label: it.name,
					description: it.description ?? null,
					layer_index: it.layer_index ?? null,
					is_unique: it.is_unique ?? null,
					concurrency: it.concurrency ?? null,
					routine_name: it.routine_name ?? null,
					service_name: it.service ?? null,
					previousTaskExecutionName: csig,
				});
			}

			continue;
		}

		const consumed = consumedSignalsMap[it.name] ?? [];

		prevs.forEach((p) => {
			const matchingSignals = consumed.filter((s: string) => Array.isArray(emittersMap[s]) && emittersMap[s].some((e: any) => String(e.task_name) === String(p)));

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
							relation: 'emitted_by',
						});
					}
					outputNodes.push({
						uuid: it.name,
						type: 'task',
						name: it.name,
						label: it.name,
						description: it.description ?? null,
						layer_index: it.layer_index ?? null,
						is_unique: it.is_unique ?? null,
						concurrency: it.concurrency ?? null,
						routine_name: it.routine_name ?? null,
						service_name: it.service ?? null,
						previousTaskExecutionName: sig,
					});
				});
			} else {
				outputNodes.push({
					uuid: it.name,
					type: 'task',
					name: it.name,
					label: it.name,
					description: it.description ?? null,
					layer_index: it.layer_index ?? null,
					is_unique: it.is_unique ?? null,
					concurrency: it.concurrency ?? null,
					routine_name: it.routine_name ?? null,
					service_name: it.service ?? null,
					previousTaskExecutionName: p ?? null,
				});
			}
		});
	}

	if (debugFlag) {
		return { nodes: outputNodes, diagnostics: { items, visited: Array.from(visited), predecessorNamesMap, consumedSignalsMap, emittersMap, emittedSignalsMap, consumersMap, successorsMap } };
	}

	return outputNodes;
});

