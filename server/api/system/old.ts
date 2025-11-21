// Fetch all service-to-service edges
async function getserviceEdges() {
  const query = `
    SELECT service_id, service_client_id
    FROM service_to_service_communication_map
  `;
  const res = await client!.query(query);
  return res.rows.map((row) => ({
    source: row.service_id,
    target: row.service_client_id,
  }));
}
import pg from 'pg';
import { initializeClient, formatDateLocale } from '~/server/api/utils';

let client: pg.Client | null = null;

// Fetch all services (services), not just active
async function getAllservices() {
  const query = `
		SELECT
    *
		FROM service s
		ORDER BY s.modified DESC
	`;
  const result = await client!.query(query);
  return result.rows.map((row) => ({
    uuid: row.uuid,
    graph: row.name,
    address: row.address,
    port: row.port,
    processPid: row.process_pid,
    status: row.is_active ? 'check' : 'schedule',
    isPrimary: row.is_primary,
    modified: formatDateLocale(row.modified),
    displayStatus: row.is_active ? 'Active' : 'Inactive',
  }));
}

// Fetch all routines for a given service
async function getRoutinesForservice(serviceId: string) {
  const query = `
		SELECT
			re.uuid,
			r.description,
			re.service_name,
			re.uuid,
			re.is_running,
			re.is_complete,
			re.errored,
			re.failed,
			re.previous_routine_execution,
			re.progress,
			re.created,
			re.ended,
			re.execution_trace_id,
			re.context_id,
			re.is_running,
			ctx.uuid AS context_id,
			ctx2.uuid AS result_context_id,
			ctx.context AS input_context,
			ctx2.context AS output_context,
			s.name,
			pre.routine_id AS previous_routine_id,
			r.name AS routine_name,
			r.description AS routine_description
		FROM routine_execution AS re
		LEFT JOIN service s on re.service_name = s.name
		LEFT JOIN routine r ON re.name = r.name
		LEFT JOIN routine_execution pre on re.previous_routine_execution = pre.uuid
		LEFT JOIN context ctx ON re.context_id = ctx.uuid
		LEFT JOIN context ctx2 ON re.result_context_id = ctx2.uuid
		WHERE re.service_name = $1
		ORDER BY re.created DESC
	`;
  const res = await client!.query(query, [serviceId]);
  return res.rows.map((row) => ({
    uuid: row.uuid,
    label: row.description,
    description: row.routine_description,
    status: row.is_complete
      ? 'check'
      : row.is_running
      ? 'play_arrow'
      : row.errored
      ? 'close'
      : 'schedule',
    progress: row.progress,
    started: row.created,
    ended: row.ended,
    contract_id: row.contract_id,
    inputContext: row.input_context,
    outputContext: row.output_context,
    routineId: row.routine_id,
    routineName: row.routine_name,
    previousRoutineExecution: row.previous_routine_execution,
  }));
}

// Fetch all tasks for a given routine
async function getTasksForRoutine(routineExecutionId: string) {
  const query = `
		SELECT te.*, t.name as task_name, tem.previous_task_execution_id
		FROM task_execution te
		LEFT JOIN task t ON te.task_id = t.uuid
		LEFT JOIN task_execution_map tem ON tem.task_execution_id = te.uuid
		WHERE te.routine_execution_id = $1
	`;
  const res = await client!.query(query, [routineExecutionId]);
  return res.rows.map((t) => ({
    uuid: t.uuid,
    label: t.task_name || t.label || t.uuid,
    name: t.task_name || t.label || t.uuid,
    started: t.started,
    ended: t.ended,
    description: t.description,
    parentNode: t.routine_execution_id,
    previousTaskExecutionId: t.previous_task_execution_id,
    isComplete: t.is_complete,
    isRunning: t.is_running,
    errored: t.errored,
    failed: t.failed,
    progress: t.progress,
    created: t.created,
    scheduled: t.scheduled,
    layer_index: t.layer_index,
    inputContext: t.input_context,
    outputContext: t.output_context,
  }));
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }
  const { method } = event.node.req;
  if (method === 'GET') {
    try {
      // 1. Get all services (services)
      const services = await getAllservices();

      // 2. For each service, get routines
      const servicesWithRoutines = await Promise.all(
        services.map(async (service) => {
          const routines = await getRoutinesForservice(service.uuid);

          // 3. For each routine, get tasks
          const routinesWithTasks = await Promise.all(
            routines.map(async (routine) => {
              const tasks = await getTasksForRoutine(routine.uuid);
              return { ...routine, tasks };
            })
          );

          return { ...service, routines: routinesWithTasks };
        })
      );

      // 4. Get service-to-service edges
      const serviceEdges = await getserviceEdges();

      return { services: servicesWithRoutines, serviceEdges };
      // Test this endpoint in your browser:
      // http://localhost:3000/api/system/system
    } catch (error) {
      console.error('Error building system map:', error);
      throw error;
    }
  }
});
