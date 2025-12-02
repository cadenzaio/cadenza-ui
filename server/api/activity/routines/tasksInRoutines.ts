import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

async function ensureClient() {
	if (!client) {
		client = await initializeClient();
	}
}

function isValidUuid(id: string) {
	if (!id || typeof id !== 'string') return false;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default defineEventHandler(async (event) => {
	await ensureClient();

	// Only allow GET
	if (event.node.req.method !== 'GET') {
		throw createError({ statusCode: 405, statusMessage: 'Method not allowed' });
	}

	const query = getQuery(event) as Record<string, any>;
	const routineExecutionId =
		query.routine_execution_id || query.routineExecutionId || null;

	if (!routineExecutionId) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Missing required query parameter `routine_execution_id`',
		});
	}

	if (!isValidUuid(routineExecutionId)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid UUID provided for `routine_execution_id`',
		});
	}

	try {
		const q = `
			SELECT
				uuid,
				routine_execution_id,
				task_name AS name,
				task_version,
				service_name,
				context_id,
				result_context_id,
				split_group_id,
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
				ended,
				deleted
			FROM task_execution
			WHERE routine_execution_id = $1
			ORDER BY created ASC
		`;

		const res = await client!.query(q, [routineExecutionId]);

		// collect ids and fetch predecessors in a single batch
		const ids = res.rows.map((r: any) => r.uuid).filter(Boolean);
		let predecessorsMap: Record<string, string[]> = {};
		if (ids.length > 0) {
			const q2 = `
				SELECT
					task_execution_id,
					previous_task_execution_id
				FROM task_execution_map
				WHERE task_execution_id = ANY($1)
			`;
			const r2 = await client!.query(q2, [ids]);
			for (const row of r2.rows) {
				const tid = String(row.task_execution_id);
				predecessorsMap[tid] = predecessorsMap[tid] || [];
				if (row.previous_task_execution_id) predecessorsMap[tid].push(row.previous_task_execution_id);
			}
			// dedupe
			for (const k of Object.keys(predecessorsMap)) {
				predecessorsMap[k] = Array.from(new Set(predecessorsMap[k]));
			}
		}

		// Transform DB rows into nodes like the example format.
		// First, fetch signals consumed by these task executions so we can create
		// duplicated task nodes that indicate `previousTaskExecutionName: signal::<emission_uuid>`.
		let consumedMap: Record<string, string[]> = {};
		const emissionNameMap: Record<string, string> = {};
		if (ids.length > 0) {
			try {
				const qc = `
				SELECT
					task_execution_id,
					signal_emission_id,
					signal_name,
					consumed_at 
				FROM signal_consumption 
				WHERE task_execution_id = ANY($1)`;
				const rc = await client!.query(qc, [ids]);
				for (const row of rc.rows) {
					const tid = String(row.task_execution_id);
					consumedMap[tid] = consumedMap[tid] || [];
					const eid = row.signal_emission_id || row.uuid || null;
					if (eid) {
						if (!consumedMap[tid].includes(eid)) consumedMap[tid].push(eid);
						if (row.signal_name) emissionNameMap[eid] = row.signal_name;
							// track consumed_at per emission (use earliest consumed_at)
							if (row.consumed_at) {
								const ts = new Date(row.consumed_at).toISOString();
								if (!emissionNameMap.__consumedAt) emissionNameMap.__consumedAt = {} as any;
								const caMap: Record<string, string> = (emissionNameMap.__consumedAt as any);
								if (!caMap[eid] || caMap[eid] > ts) caMap[eid] = ts;
							}
					}
				}
			} catch (e) {
				console.error('Error fetching signal_consumption for tasks:', e);
				consumedMap = {};
			}
		}

		// Build task nodes, duplicating when the task consumed signals.
		const taskNodes: any[] = [];
		for (const row of res.rows) {
			const base = {
				uuid: row.uuid,
				type: 'task',
				name: row.name,
				label: row.name,
				description: null,
				layer_index: null,
				is_unique: null,
				concurrency: null,
				execution_trace_id: row.execution_trace_id || null,
				executionTraceId: row.execution_trace_id || row.executionTraceId || null,
				created: row.created ? new Date(row.created).toISOString() : null,
				// include started so frontends can order and render tasks correctly
				started: row.started ? new Date(row.started).toISOString() : null,
				ended: row.ended ? new Date(row.ended).toISOString() : null,
				previousTaskExecutionName: (predecessorsMap[row.uuid] && predecessorsMap[row.uuid].length > 0) ? predecessorsMap[row.uuid][0] : null,
				previousTaskExecutionId: (predecessorsMap[row.uuid] && predecessorsMap[row.uuid].length > 0) ? predecessorsMap[row.uuid][0] : null,
			};
			taskNodes.push(base);

			const consumed = consumedMap[row.uuid] || [];
			for (const sig of consumed) {
				const dup = { ...base };
				dup.previousTaskExecutionName = `signal::${sig}`;
				dup.previousTaskExecutionId = sig;
				taskNodes.push(dup);
			}
		}

		// Fetch signal emissions for this routine and build unique signal nodes keyed by emission uuid.
		let emissionRows: any[] = [];
		try {
			const q3 = `
				SELECT
					uuid,
					signal_name,
					signal_tag,
					task_name,
					task_version,
					task_execution_id,
					service_name,
					service_instance_id,
					execution_trace_id,
					routine_execution_id,
					data,
					metadata,
					is_meta,
					is_metric,
					emitted_at,
					created
				FROM signal_emission
				WHERE routine_execution_id = $1
				ORDER BY created ASC
			`;
			const r3 = await client!.query(q3, [routineExecutionId]);
			emissionRows = r3.rows;
		} catch (e) {
			console.error('Error fetching signal emissions for routine:', e);
			emissionRows = [];
		}

		// Build unique signal nodes keyed by emission uuid
		const signalMap: Record<string, any> = {};
		const consumedEmissionSet = new Set<string>(Object.values(consumedMap).flat());

		// invert consumedMap (taskExecutionId -> [emissionIds]) to emissionId -> [consumerTaskExecutionIds]
		const consumersByEmission: Record<string, string[]> = {};
		// map of emissionId -> earliest consumed_at ISO string (if available)
		const consumedAtByEmission: Record<string, string> = {};
		for (const [tid, emissions] of Object.entries(consumedMap)) {
			for (const eid of emissions) {
				consumersByEmission[eid] = consumersByEmission[eid] || [];
				if (!consumersByEmission[eid].includes(tid)) consumersByEmission[eid].push(tid);
			}
		}

		// if we recorded consumed_at values on emissionNameMap.__consumedAt, move them to consumedAtByEmission
		if ((emissionNameMap as any).__consumedAt) {
			const caMap: Record<string, string> = (emissionNameMap as any).__consumedAt;
			for (const [k, v] of Object.entries(caMap)) consumedAtByEmission[k] = v;
			delete (emissionNameMap as any).__consumedAt;
		}

		for (const row of emissionRows) {
			const emissionId = row.uuid || row.id || null;
			const sig = row.signal_name || null;
			if (!emissionId || !sig) continue;
			if (!signalMap[emissionId]) {
				const emitterTaskExecutionId = row.task_execution_id || null;
				// prefer emitted_at for start, fallback to consumed_at; ended will be start + 500ms
				const consumedAt = consumedAtByEmission[emissionId] || null;
				const emittedAtTs = row.emitted_at ? new Date(row.emitted_at).getTime() : null;
				const consumedAtTs = consumedAt ? new Date(consumedAt).getTime() : null;
				const baseTs = emittedAtTs || consumedAtTs || null;
				const startedIso = baseTs ? new Date(baseTs).toISOString() : null;
				const endedIso = baseTs ? new Date(baseTs + 500).toISOString() : null;

				signalMap[emissionId] = {
					// Use the raw emission UUID as the node uuid (no prefix)
					uuid: emissionId,
					type: 'signal',
					name: sig,
					label: sig,
					description: null,
					layer_index: null,
					is_unique: false,
					concurrency: null,
					// link to the emitter task execution
					previousTaskExecutionName: emitterTaskExecutionId || null,
					previousTaskExecutionId: emitterTaskExecutionId || null,
					signal: true,
					service_name: row.service_name || null,
					created: row.emitted_at ? new Date(row.emitted_at).toISOString() : (row.created ? new Date(row.created).toISOString() : null),
					// set started to emitted_at (if present) or consumed_at; ended = started + 500ms
					started: startedIso,
					ended: endedIso,
					relation: consumedEmissionSet.has(emissionId) ? 'consumed_by' : 'emitted_by',
					// list of task_execution_ids that consumed this emission
					consumedBy: consumersByEmission[emissionId] || [],
				};
			}
		}

		// Add synthetic signal nodes for any consumed emissions that weren't present in `signal_emission`.
		for (const eid of consumedEmissionSet) {
			if (!signalMap[eid]) {
				signalMap[eid] = {
					uuid: eid,
					type: 'signal',
					name: emissionNameMap[eid] || ('signal'),
					label: emissionNameMap[eid] || ('signal'),
					description: null,
					layer_index: null,
					is_unique: false,
					concurrency: null,
					previousTaskExecutionName: null,
					previousTaskExecutionId: null,
					signal: true,
					service_name: null,
					// for synthetic nodes, prefer consumedAt for start/ended when available
					created: null,
					started: consumedAtByEmission[eid] ? new Date(consumedAtByEmission[eid]).toISOString() : null,
					ended: consumedAtByEmission[eid] ? new Date(new Date(consumedAtByEmission[eid]).getTime() + 500).toISOString() : null,
					relation: 'consumed_by',
					consumedBy: consumersByEmission[eid] || [],
				};
			}
		}

		const signalNodes = Object.values(signalMap);

		// Return tasks first, then signals
		return [...taskNodes, ...signalNodes];
	} catch (err) {
		console.error('Error fetching task executions for routine:', err);
		throw createError({ statusCode: 500, statusMessage: 'Failed to fetch task executions' });
	}
});

