import pg from 'pg';
import { initializeClient, formatDate } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

// Type for contract row
interface ContractRow {
  uuid: string;
  product: string;
  label: string;
  description: string;
  issued_at: string | Date;
  fulfilled: boolean;
  referer: string;
  input_context: Record<string, unknown>;
  output_context: Record<string, unknown>;
  created: string | Date;
  fulfilled_at: string | Date | null;
  result_context: string;
  from_url: string;
  headers: string;
  method: string;
  credentials: string;
  mode: string;
}

// Get all contracts
async function getContracts(uuid?: string, page?: number, limit?: number) {
  let query = `
    SELECT contract.*,
      ctx_in.context AS input_context,
      ctx_out.context AS output_context
    FROM contract
    LEFT JOIN context AS ctx_in ON contract.context = ctx_in.uuid
    LEFT JOIN context AS ctx_out ON contract.result_context = ctx_out.uuid
  `;
  const params: any[] = [];
  let paramIndex = 1;

  if (uuid) {
    query += ' WHERE contract.uuid = $' + paramIndex;
    params.push(uuid);
    paramIndex++;
  }

  // Add ordering
  query += ' ORDER BY contract.issued_at DESC';

  // Add pagination if provided
  if (limit !== undefined) {
    query += ' LIMIT $' + paramIndex;
    params.push(limit);
    paramIndex++;

    if (page !== undefined && page > 1) {
      const offset = (page - 1) * limit;
      query += ' OFFSET $' + paramIndex;
      params.push(offset);
      paramIndex++;
    }
  }

  const res = await client!.query(query, params);

  return res.rows.map((row: ContractRow) => ({
    uuid: row.uuid,
    name: row.product,
    label: row.label,
    description: row.description,
    issued: formatDate(
      typeof row.issued_at === 'string'
        ? row.issued_at
        : row.issued_at.toISOString()
    ),
    status: row.fulfilled ? 'check' : 'schedule',
    product: row.product,
    referer: row.referer,
    input_context: row.input_context,
    output_context: row.output_context,
    created: row.created,
    fulfilled: row.fulfilled,
    fulfilled_at: row.fulfilled_at,
    result_context: row.result_context,
    from_url: row.from_url,
    headers: row.headers,
    method: row.method,
    credentials: row.credentials,
    mode: row.mode,
  }));
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const uuid = query.uuid as string | undefined;
      const page = query.page ? parseInt(query.page as string, 10) : 1;
      const limit = query.limit
        ? parseInt(query.limit as string, 10)
        : undefined;

      // Fetch contracts with pagination
      const contracts = await getContracts(uuid, page, limit);

      // If a single contract is requested, fetch routines and servers
      let routines = [];
      let servers = [];
      let tasks = [];
      if (uuid && contracts.length > 0) {
        // 1. Fetch routines for this contract
        const routinesRes = await client.query(
          `SELECT * FROM routine_execution WHERE contract_id = $1`,
          [uuid]
        );
        routines = routinesRes.rows;

        // 2. Get unique server_ids
        const serverIds = [...new Set(routines.map((r) => r.server_id))];
        if (serverIds.length > 0) {
          // 3. Fetch servers
          const serversRes = await client.query(
            `SELECT * FROM server WHERE uuid = ANY($1)`,
            [serverIds]
          );
          servers = serversRes.rows;
        }

        // 4. Get all tasks for the routines, including task name and dependencies
        const routineIds = routines.map((r) => r.uuid);
        if (routineIds.length > 0) {
          const tasksRes = await client.query(
            `SELECT te.*, t.name as task_name, tem.previous_task_execution_id
             FROM task_execution te
             LEFT JOIN task t ON te.task_id = t.uuid
             LEFT JOIN task_execution_map tem ON tem.task_execution_id = te.uuid
             WHERE te.routine_execution_id = ANY($1)`,
            [routineIds]
          );
          tasks = tasksRes.rows;
        }
      }

      return {
        contracts: contracts,
        routines: routines,
        servers: servers,
        tasks: tasks,
      };
    } catch (error) {
      console.error('Error fetching contracts:', error);
      throw error;
    }
  }
});
