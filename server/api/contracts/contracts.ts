import pg from 'pg';
import { initializeClient, formatDate } from '~/server/api/utils';
import { getQuery } from 'h3';

let client: pg.Client | null = null;

// Get all contracts
async function getContracts(uuid?: string, page?: number, limit?: number) {
  let query = `
    SELECT contract.*, agent.name AS agent_name,
      ctx_in.context AS input_context,
      ctx_out.context AS output_context
    FROM contract
    LEFT JOIN agent ON contract.agent_id = agent.uuid
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

  return res.rows.map((row) => ({
    uuid: row.uuid,
    name: row.product,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    label: row.label,
    description: row.description,
    issued: formatDate(row.issued_at),
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

      return {
        contracts: contracts,
      };
    } catch (error) {
      console.error('Error fetching contracts:', error);
      throw error;
    }
  }
});
