import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery, readBody } from 'h3';

let client: pg.Client | null = null;

async function ensureClient() {
	if (!client) {
		client = await initializeClient();
	}
}

async function getTaskDetails(name: string, version?: string | null, service?: string | null) {
	const params: any[] = [name];
	let q = `SELECT name, description, layer_index, is_unique, concurrency, service_name, version FROM task WHERE name = $1`;
	if (version) {
		params.push(version);
		q += ` AND version = $${params.length}`;
	}
	if (service) {
		params.push(service);
		q += ` AND service_name = $${params.length}`;
	}
	q += ` LIMIT 1`;
	const r = await client!.query(q, params as any);
	return r.rows[0] ?? null;
}

async function getSignalsConsumedByTaskName(taskName: string) {
	const q = `
		SELECT DISTINCT signal_name, signal_service_name AS service_name
		FROM signal_to_task_map
		WHERE task_name = $1
	`;
	const r = await client!.query(q, [taskName]);
	return r.rows; // [{ signal_name, service_name }, ...]
}

async function getEmittersForSignal(signalName: string) {
	const q = `
		SELECT DISTINCT task_name, service_name
		FROM task_to_signal_map
		WHERE signal_name = $1
	`;
	const r = await client!.query(q, [signalName]);
	return r.rows; // [{ task_name, service_name }, ...]
}

async function getSignalsEmittedByTaskName(taskName: string) {
	const q = `
		SELECT DISTINCT signal_name
		FROM task_to_signal_map
		WHERE task_name = $1
	`;
	const r = await client!.query(q, [taskName]);
	return r.rows.map((r: any) => r.signal_name);
}

async function getConsumersForSignal(signalName: string) {
	const q = `
		SELECT DISTINCT task_name, signal_service_name AS service_name
		FROM signal_to_task_map
		WHERE signal_name = $1
	`;
	const r = await client!.query(q, [signalName]);
	return r.rows; // [{ task_name, service_name }, ...]
}

async function getPredecessors(name: string, version?: string | null, service?: string | null) {
	const params: any[] = [name];
	let q = `SELECT predecessor_task_name, predecessor_task_version FROM directional_task_graph_map WHERE task_name = $1`;
	if (version) {
		params.push(version);
		q += ` AND task_version = $${params.length}`;
	}
	if (service) {
		params.push(service);
		q += ` AND service_name = $${params.length}`;
	}
	const r = await client!.query(q, params as any);
	return r.rows || [];
}

async function getSuccessors(name: string, version?: string | null, service?: string | null) {
	const params: any[] = [name];
	let q = `SELECT task_name, task_version FROM directional_task_graph_map WHERE predecessor_task_name = $1`;
	if (version) {
		params.push(version);
		q += ` AND predecessor_task_version = $${params.length}`;
	}
	if (service) {
		params.push(service);
		q += ` AND service_name = $${params.length}`;
	}
	const r = await client!.query(q, params as any);
	return r.rows || [];
}

export default defineEventHandler(async (event) => {
	await ensureClient();

	// Support GET query params or POST JSON body
	const query = getQuery(event) as Record<string, any>;
	let taskName = query.task_name || query.taskName || query.name || null;
	let version = query.version || query.task_version || null;
	let service = query.service || query.serviceName || query.service_name || null;
	const debugFlag = (query.debug === '1' || query.debug === 'true');

	if (event.node.req.method === 'POST') {
		try {
			const body = await readBody(event) as any;
			taskName = taskName || body.task_name || body.taskName || body.name;
			version = version || body.version || body.task_version || null;
			service = service || body.service || body.serviceName || body.service_name || null;
		} catch (e) {
			// ignore body parse errors and fall back to query params
		}
	}

	if (!taskName) {
		throw new Error('Missing required parameter: task_name (or taskName / name)');
	}

	// Normalize taskName encoding
	try { taskName = decodeURIComponent((taskName as string).replace(/\+/g, ' ')); } catch (e) { /* ignore */ }

	// Build a closure (BFS) around the requested task so we include all
	// reachable predecessors and successors (within the same service/version
	// constraints). This ensures that if a node (like ComputeFailurePrediction)
	// has multiple predecessors (e.g. AnalyzeAnomalyHistory and CallWeatherApi)
	// both predecessors will be included and the node will be duplicated with
	// different previousTaskExecutionName values.
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

		// fetch predecessors and record them
		try {
			const preds = await getPredecessors(cur, version, service);
			const predNames = Array.from(new Set((preds || []).map((p: any) => p.predecessor_task_name).filter(Boolean)));
			predecessorsMap[cur] = predNames;
			predNames.forEach((pn) => {
				if (!itemsMap[pn]) itemsMap[pn] = { name: pn, version: null, service };
				if (!visited.has(pn) && !toVisit.includes(pn)) toVisit.push(pn);
			});
		} catch (e) {
			predecessorsMap[cur] = predecessorsMap[cur] || [];
		}

		// fetch successors and record them
		try {
			const succs = await getSuccessors(cur, version, service);
			const succNames = Array.from(new Set((succs || []).map((s: any) => s.task_name).filter(Boolean)));
			successorsMap[cur] = succNames;
			succNames.forEach((sn) => {
				if (!itemsMap[sn]) itemsMap[sn] = { name: sn, version: null, service };
				if (!visited.has(sn) && !toVisit.includes(sn)) toVisit.push(sn);
			});
		} catch (e) {
			successorsMap[cur] = successorsMap[cur] || [];
		}
	}

	// Final items list is the visited set (convert to array). We'll enrich
	// this list. Use insertion order from itemsMap keys filtered by visited
	// so deterministic ordering is preserved as much as possible.
	const items = Object.keys(itemsMap).filter((k) => visited.has(k)).map((k) => ({ name: k, version: itemsMap[k].version ?? null, service: itemsMap[k].service }));

	// Ensure we have the full set of predecessors for every item in the
	// chain. This allows us to emit duplicate task objects (one per
	// predecessor) when a task has multiple inputs.
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

	// Prefetch emitters for all consumed signals to avoid DB calls inside the loop
	const allSignals = Array.from(new Set(Object.values(consumedSignalsMap).flat()));
	const emittersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};
	await Promise.all(allSignals.map(async (s) => {
		try {
			const emitters = await getEmittersForSignal(s);
			emittersMap[s] = Array.from(new Map((emitters || []).map((e: any) => [String(e.task_name), { task_name: e.task_name, service_name: e.service_name }])).values());
		} catch (e) {
			emittersMap[s] = [];
		}
	}));

	// Prefetch signals emitted by each item (so we can show outgoing signals
	// even when a task has no predecessors) and consumers for those signals.
	const emittedSignalsMap: Record<string, string[]> = {};
	await Promise.all(items.map(async (it) => {
		try {
			emittedSignalsMap[it.name] = await getSignalsEmittedByTaskName(it.name) || [];
		} catch (e) {
			emittedSignalsMap[it.name] = [];
		}
	}));

	const allEmittedSignals = Array.from(new Set(Object.values(emittedSignalsMap).flat()));
	// Build consumers map for both emitted signals and signals that are
	// consumed by tasks in our closure. This lets us show consumer tasks even
	// when no emitter exists in the `task_to_signal_map`.
	const signalsToFetchConsumers = Array.from(new Set([...allEmittedSignals, ...allSignals]));
	const consumersMap: Record<string, Array<{ task_name: string; service_name?: string }>> = {};
	await Promise.all(signalsToFetchConsumers.map(async (s) => {
		try {
			const consumers = await getConsumersForSignal(s);
			consumersMap[s] = Array.from(new Map((consumers || []).map((c: any) => [String(c.task_name), { task_name: c.task_name, service_name: c.service_name }])).values());
		} catch (e) {
			consumersMap[s] = [];
		}
	}));

	// Enrich with task details where available and attach a single-string
	// `previousExecution` value and `previousExecutions` array containing the
	// predecessor names (may be multiple). If no predecessors are found,
	// fall back to the linear neighbor order.
	const enriched = await Promise.all(items.map(async (it) => {
		// Only use explicit predecessors discovered in the directional map.
		// Do NOT fall back to a linear neighbor — that caused incorrect
		// loopback predecessors when ordering changed.
		const prevList = predecessorNamesMap[it.name] ?? [];
		const previousExecution = prevList.length > 0 ? prevList[0] : null;
		const previousExecutions = prevList.length > 0 ? prevList : [];
		try {
			const det = await getTaskDetails(it.name, it.version, it.service);
			return {
				name: it.name,
				version: it.version ?? (det ? det.version : null),
				service: it.service ?? (det ? det.service_name : null),
				description: det ? det.description : null,
				layer_index: det ? det.layer_index : null,
				is_unique: det ? det.is_unique : null,
				concurrency: det ? det.concurrency : null,
				previousExecution,
				previousExecutions,
			};
		} catch (e) {
			return { name: it.name, version: it.version ?? null, service: it.service ?? null, previousExecution, previousExecutions };
		}
	}));

	// Transform enriched items into the shape expected by FlowMap/consumers.
	// If a task has multiple predecessors, emit one entry per predecessor
	// with `previousTaskExecutionName` set to that predecessor. If none,
	// emit a single entry with `previousTaskExecutionName: null`.
	const outputNodes: any[] = [];
	// Keep track of signal nodes we've already pushed to avoid duplicates
	const pushedSignalIds = new Set<string>();

	for (const it of enriched) {
		const prevs: string[] = Array.isArray(it.previousExecutions) ? it.previousExecutions : [];

		// If there are no explicit predecessors, emit the task with null previous
		// If there are no explicit predecessors, emit the task with null previous.
		// Also, if this task emits signals, show those signal nodes (and any
		// consumers of those signals) so emitters are visible in the graph.
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
				previousTaskExecutionName: null,
			});

			// Show signals emitted by this task (even if no consumers exist).
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
							relation: 'emitted_by'
						});
					}

					// Push any consumers of this signal (duplicate consumer task entries
					// with previous set to the signal name so the graph links signal->consumer).
					const consumers = consumersMap[sig] ?? [];
					for (const c of consumers) {
						let detC = null;
						try {
							detC = await getTaskDetails(c.task_name, null, c.service_name);
						} catch (e) {
							detC = null;
						}
						outputNodes.push({
							uuid: c.task_name,
							type: 'task',
							name: c.task_name,
							label: c.task_name,
							description: detC ? detC.description : null,
							layer_index: detC ? detC.layer_index : null,
							is_unique: detC ? detC.is_unique : false,
							concurrency: detC ? detC.concurrency : null,
							previousTaskExecutionName: sig,
						});
					}
				}

				// Also, if this task itself consumes signals (but no emitter exists),
				// surface those consumed signals so consumers appear even when the
				// emitters are not recorded in `task_to_signal_map`.
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
							relation: 'consumed_by'
						});
					}
					// duplicate the consumer task entry with the signal as previous
					outputNodes.push({
						uuid: it.name,
						type: 'task',
						name: it.name,
						label: it.name,
						description: it.description ?? null,
						layer_index: it.layer_index ?? null,
						is_unique: it.is_unique ?? null,
						concurrency: it.concurrency ?? null,
						previousTaskExecutionName: csig,
					});
				}

				continue;
			}

		// For each predecessor, check whether this task consumes any signals
		// that are emitted by that predecessor. If so, insert a signal node
		// and then duplicate the task with previous pointing at the signal.
		const consumed = consumedSignalsMap[it.name] ?? [];

		prevs.forEach((p) => {
			// Find consumed signals for which `p` is an emitter
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
							relation: 'emitted_by'
						});
					}
					// push the task duplicate which consumes the signal
					outputNodes.push({
						uuid: it.name,
						type: 'task',
						name: it.name,
						label: it.name,
						description: it.description ?? null,
						layer_index: it.layer_index ?? null,
						is_unique: it.is_unique ?? null,
						concurrency: it.concurrency ?? null,
						previousTaskExecutionName: sig,
					});
				});
			} else {
				// No matching signal emitted by this predecessor; link predecessor directly
				outputNodes.push({
					uuid: it.name,
					type: 'task',
					name: it.name,
					label: it.name,
					description: it.description ?? null,
					layer_index: it.layer_index ?? null,
					is_unique: it.is_unique ?? null,
					concurrency: it.concurrency ?? null,
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
				predecessorNamesMap,
				consumedSignalsMap,
				emittersMap,
				emittedSignalsMap,
				consumersMap,
				successorsMap,
			},
		};
	}

	// Return a plain array of nodes (no `chain` wrapper)
	return outputNodes;
});

