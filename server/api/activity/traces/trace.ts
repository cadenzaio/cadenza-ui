import pg from 'pg';
import { initializeClient } from '~/server/api/utils';
import { defineEventHandler, getQuery } from 'h3';

type ActivityTrace = Record<string, any>;

let client: pg.Client | null = null;

// Get all Activity Traces with pagination support and optional UUID filtering
async function getActivityTraces(page: number = 1, limit: number = 100, uuid?: string) {
  const offset = (page - 1) * limit;
  let query = `
    SELECT 
      et.uuid AS trace_uuid, 
      et.issuer_type, 
      et.issuer_id, 
      et.context_id, 
      et.intent, 
      et.service_instance_id, 
      et.service_name, 
      et.issued_at, 
      et.created, 
      et.is_meta, 
      et.deleted, 
      re.name, 
      te.task_name, 
      te.routine_execution_id
    FROM execution_trace et
    LEFT JOIN routine_execution re
    ON et.uuid = re.execution_trace_id AND re.is_meta = false
    LEFT JOIN task_execution te
    ON re.uuid = te.routine_execution_id AND te.is_meta = false
    WHERE et.is_meta = false
  `;

  const params: (string | number)[] = [limit, offset];

  if (uuid) {
    query += ` AND et.uuid = $3`;
    params.push(uuid);
  }

  query += `
    ORDER BY et.created DESC
    LIMIT $1 OFFSET $2;
  `;

  const res = await client!.query(query, params);

  // Group routines and tasks by execution trace
  const tracesMap: Record<string, any> = {};

  res.rows.forEach((row) => {
    if (!tracesMap[row.trace_uuid]) {
      tracesMap[row.trace_uuid] = {
        uuid: row.trace_uuid,
        issuerType: row.issuer_type,
        issuerId: row.issuer_id,
        contextId: row.context_id,
        intent: row.intent,
        serviceInstanceId: row.service_instance_id,
        serviceName: row.service_name,
        issuedAt: row.issued_at,
        created: row.created,
        isMeta: row.is_meta,
        deleted: row.deleted,
        routines: [],
      };
    }

    let routine = tracesMap[row.trace_uuid].routines.find((r: any) => r.routineName === row.routine_name);
    if (!routine && (row.routine_name || row.routine_status)) {
      routine = {
        routineName: row.routine_name,
        routineStatus: row.routine_status,
        tasks: [],
      };
      tracesMap[row.trace_uuid].routines.push(routine);
    }

    if (routine && (row.task_name || row.task_status)) {
      routine.tasks.push({
        taskName: row.task_name,
        taskStatus: row.task_status,
      });
    }
  });

  return Object.values(tracesMap);
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;
      const uuid = query.uuid as string | undefined;

      return await getActivityTraces(page, limit, uuid);
    } catch (error) {
      console.error('Error fetching activity traces:', error);
      throw error;
    }
  }
});