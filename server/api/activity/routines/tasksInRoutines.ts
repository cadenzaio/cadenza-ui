import { supabaseAdmin } from '~/utils/supabase';
import { getQuery } from 'h3';

function isValidUuid(id: string) {
	if (!id || typeof id !== 'string') return false;
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export default defineEventHandler(async (event) => {
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
		const { data: taskExecutions, error: taskError } = await supabaseAdmin.rpc('get_task_executions_for_routine', {
			routine_execution_id_param: routineExecutionId
		});

		if (taskError) {
			console.error('Error fetching task executions:', taskError);
			throw createError({ statusCode: 500, statusMessage: 'Failed to fetch task executions' });
		}

		const ids = taskExecutions.map((r: any) => r.uuid).filter(Boolean);
		let predecessorsMap: Record<string, string[]> = {};
		if (ids.length > 0) {
			const { data: predecessors, error: predError } = await supabaseAdmin.rpc('get_task_execution_predecessors', {
				task_execution_ids: ids
			});

			if (predError) {
				console.error('Error fetching predecessors:', predError);
			} else {
				for (const row of predecessors) {
					const tid = String(row.task_execution_id);
					predecessorsMap[tid] = predecessorsMap[tid] || [];
					if (row.previous_task_execution_id) predecessorsMap[tid].push(row.previous_task_execution_id);
				}
				for (const k of Object.keys(predecessorsMap)) {
					predecessorsMap[k] = Array.from(new Set(predecessorsMap[k]));
				}
			}
		}

		let consumedMap: Record<string, string[]> = {};
		const emissionNameMap: Record<string, string> = {};
		if (ids.length > 0) {
			for (const row of taskExecutions) {
				const tid = String(row.uuid);
				if (!row.signal_emission_id) continue;
				consumedMap[tid] = consumedMap[tid] || [];
				const eid = row.signal_emission_id;
				if (!consumedMap[tid].includes(eid)) consumedMap[tid].push(eid);
			}
		}

		const taskNodes: any[] = [];
		for (const row of taskExecutions) {
			const base = {
				uuid: row.uuid,
				type: 'task',
				name: row.task_name,
				label: row.task_name,
				description: null,
				layer_index: null,
				errored: row.errored || false,
				failed: row.failed || false,
				isComplete: row.is_complete || false,
				is_unique: null,
				concurrency: null,
				execution_trace_id: row.execution_trace_id || null,
				executionTraceId: row.execution_trace_id || row.executionTraceId || null,
				created: row.created ? new Date(row.created).toISOString() : null,
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

		let emissionRows: any[] = [];
		try {
			const { data: emissions, error: emissionError } = await supabaseAdmin.rpc('get_signal_emissions_for_routine', {
				routine_execution_id_param: routineExecutionId
			});

			if (emissionError) {
				console.error('Error fetching signal emissions for routine:', emissionError);
				emissionRows = [];
			} else {
				emissionRows = emissions;
			}
		} catch (e) {
			console.error('Error fetching signal emissions for routine:', e);
			emissionRows = [];
		}

		const signalMap: Record<string, any> = {};
		const consumedEmissionSet = new Set<string>(Object.values(consumedMap).flat());
		const consumersByEmission: Record<string, string[]> = {};
		const consumedAtByEmission: Record<string, string> = {};
		for (const [tid, emissions] of Object.entries(consumedMap)) {
			for (const eid of emissions) {
				consumersByEmission[eid] = consumersByEmission[eid] || [];
				if (!consumersByEmission[eid].includes(tid)) consumersByEmission[eid].push(tid);
			}
		}

		for (const row of emissionRows) {
			const emissionId = row.uuid || row.id || null;
			const sig = row.signal_name || null;
			if (!emissionId || !sig) continue;
			emissionNameMap[emissionId] = sig;
			if (!signalMap[emissionId]) {
				const emitterTaskExecutionId = row.task_execution_id || null;
				const consumedAt = consumedAtByEmission[emissionId] || null;
				const emittedAtTs = row.emitted_at ? new Date(row.emitted_at).getTime() : null;
				const consumedAtTs = consumedAt ? new Date(consumedAt).getTime() : null;
				const baseTs = emittedAtTs || consumedAtTs || null;
				const startedIso = baseTs ? new Date(baseTs).toISOString() : null;
				const endedIso = baseTs ? new Date(baseTs + 500).toISOString() : null;

				signalMap[emissionId] = {
					uuid: emissionId,
					type: 'signal',
					name: sig,
					label: sig,
					description: null,
					layer_index: null,
					is_unique: false,
					concurrency: null,
					previousTaskExecutionName: emitterTaskExecutionId || null,
					previousTaskExecutionId: emitterTaskExecutionId || null,
					signal: true,
					service_name: row.service_name || null,
					created: row.emitted_at ? new Date(row.emitted_at).toISOString() : (row.created ? new Date(row.created).toISOString() : null),
					started: startedIso,
					ended: endedIso,
					relation: consumedEmissionSet.has(emissionId) ? 'consumed_by' : 'emitted_by',
					consumedBy: consumersByEmission[emissionId] || [],
				};
			}
		}

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
					created: null,
					started: consumedAtByEmission[eid] ? new Date(consumedAtByEmission[eid]).toISOString() : null,
					ended: consumedAtByEmission[eid] ? new Date(new Date(consumedAtByEmission[eid]).getTime() + 500).toISOString() : null,
					relation: 'consumed_by',
					consumedBy: consumersByEmission[eid] || [],
				};
			}
		}

		const signalNodes = Object.values(signalMap);

		// Set timestamps for consumed signals based on consuming task
		for (const sig of signalNodes) {
			if (sig.relation === 'consumed_by' && sig.consumedBy && sig.consumedBy.length > 0) {
				const consumerId = sig.consumedBy[0];
				const consumer = taskNodes.find(t => t.uuid === consumerId);
				if (consumer && consumer.started) {
					sig.started = consumer.started;
					sig.ended = new Date(new Date(sig.started).getTime() + 500).toISOString();
				}
			}
		}

		return [...taskNodes, ...signalNodes];
	} catch (err) {
		console.error('Error fetching task executions for routine:', err);
		throw createError({ statusCode: 500, statusMessage: 'Failed to fetch task executions' });
	}
});

