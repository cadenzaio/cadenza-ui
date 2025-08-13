import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';
import { removeMetaData } from '~/src/util';

let client: pg.Client | null = null;

// Get routines for a specific contract with mapping
async function getContractRoutines(contractId: string) {
  if (!client) {
    client = await initializeClient();
  }

  const query = `
    SELECT
        re.uuid,
        re.description,
        re.server_id,
        re.routine_id,
        re.is_running,
        re.is_complete,
        re.errored,
        re.failed,
        re.previous_routine_execution,
        re.progress,
        re.created,
        re.ended,
        re.contract_id,
        re.context_id,
        re.is_running,
        ctx.uuid AS context_id,
        ctx2.uuid AS result_context_id,
        ctx.context AS input_context,
        ctx2.context AS output_context,
        s.processing_graph,
        s.address,
        s.port,
        pre.routine_id AS previous_routine_id,
        r.name AS routine_name,
        r.description AS routine_description
    FROM routine_execution AS re
    LEFT JOIN server s on re.server_id = s.uuid
    LEFT JOIN routine r ON re.routine_id = r.uuid
    LEFT JOIN routine_execution pre on re.previous_routine_execution = pre.uuid
    LEFT JOIN context ctx ON re.context_id = ctx.uuid
    LEFT JOIN context ctx2 ON re.result_context_id = ctx2.uuid
    WHERE re.contract_id = $1
    ORDER BY re.created DESC
  `;

  try {
    const res = await client.query(query, [contractId]);

    // Map the results for table display
    const routines = res.rows.map((row) => ({
      uuid: row.uuid,
      label: row.description,
      description: row.routine_description,
      status: row.is_complete
        ? 'check'
        : row.is_running
        ? 'play_arrow'
        : 'schedule',
      progress: row.progress,
      started: formatDate(row.created),
      ended: formatDate(row.ended),
      scheduled: row.created,
      layer_index: row.layer_index || 0,
      duration: getDuration(row.created, row.ended),
      contract_id: row.contract_id,
      errored: row.errored,
      contextId: row.context_id,
      inputContext: removeMetaData(row.input_context),
      outputContext: removeMetaData(row.output_context),
    }));

    // Map the results for routine map display
    const routineMap = res.rows.map((row) => ({
      uuid: row.uuid,
      description: row.routine_description,
      server_id: row.server_id,
      routine_id: row.routine_id,
      is_running: row.is_running,
      is_complete: row.is_complete,
      errored: row.errored === 'Errored',
      failed: row.failed,
      previous_routine_execution: row.previous_routine_execution,
      progress: row.progress,
      created: row.created,
      ended: row.ended,
      contract_id: row.contract_id,
      context_id: row.context_id,
      result_context_id: row.result_context_id,
      processing_graph: row.processing_graph,
      address: row.address,
      port: row.port,
      previous_routine_id: row.previous_routine_id,
      routine_name: row.routine_name,
      routine_description: row.routine_description,
      layer_index: row.layer_index || 0,
      previousTaskExecutionId: row.previous_routine_execution,
      inputContext: removeMetaData(row.input_context),
      outputContext: removeMetaData(row.output_context),
    }));

    return {
      routines,
      routineMap,
    };
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }
  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const contractId = getRouterParam(event, 'id');
      if (!contractId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Contract ID is required',
        });
      }

      const data = await getContractRoutines(contractId);
      return data;
    } catch (error) {
      console.error('Error fetching contract routines:', error);
      throw error;
    }
  }
});
