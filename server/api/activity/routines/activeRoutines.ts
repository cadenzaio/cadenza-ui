import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';
import { removeMetaData } from '~/src/util';

let client: pg.Client | null = null;

// Get all routines or a single routine by uuid
async function getRoutines({
  uuid,
  page = 1,
  limit = 50,
}: {
  uuid?: string;
  page?: number;
  limit?: number;
}) {
  if (!client) {
    client = await initializeClient();
  }

  let query = `
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
  `;

  let where = '';
  let params: any[] = [];
  if (uuid) {
    where = 'WHERE re.uuid = $1';
    params.push(uuid);
  }

  const orderQuery = `ORDER BY re.created DESC`;
  const limitQuery = uuid ? '' : `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

  const fullQuery = [query, where, orderQuery, limitQuery]
    .filter(Boolean)
    .join(' ');

  try {
    const res = await client.query(fullQuery, params);
    return res.rows.map((row) => ({
      id: row.uuid,
      name: row.description,
      type: 'routine',
      label: row.description,
      description: row.routine_description,
      routineDescription: row.routine_description,
      serverId: row.server_id,
      routineId: row.routine_id,
      status: row.is_complete
        ? 'check'
        : row.is_running
        ? 'play_arrow'
        : row.errored
        ? 'close'
        : 'schedule',
      previousRoutineExecution: row.previous_routine_execution,
      progress: row.progress,
      started: formatDate(row.created),
      ended: formatDate(row.ended),
      duration: getDuration(row.created, row.ended),
      uuid: row.uuid,
      serverName: row.processing_graph + '@' + row.address + ':' + row.port,
      previousRoutineName: row.routine_name,
      contract_id: row.contract_id,
      processingGraph: row.processing_graph,
      inputContext: removeMetaData(row.input_context),
      outputContext: removeMetaData(row.output_context),
      isRunning: row.is_running,
      referer: row.errored ? 'Errored' : null,
    }));
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
  const { method, url } = event.node.req || {};

  if (method === 'GET') {
    const urlParams = url
      ? new URLSearchParams(url.split('?')[1])
      : new URLSearchParams();
    const page = parseInt(urlParams.get('page') || '1', 10);
    const limit = parseInt(urlParams.get('limit') || '50', 10);
    const contractId = urlParams.get('contractId') || undefined;

    try {
      const uuid = urlParams.get('uuid') || undefined;
      const data = await getRoutines({ uuid, page, limit });

      // If contractId is provided, filter and return mapped data for contract page
      if (contractId) {
        const filteredData = data.filter(
          (r: any) => r.contract_id === contractId
        );

        // Map for table display
        const routines = filteredData.map((r: any) => ({
          uuid: r.uuid,
          label: r.label,
          description: r.routineDescription,
          status: r.isComplete
            ? 'check'
            : r.isRunning
            ? 'play_arrow'
            : 'schedule',
          progress: r.progress,
          started: r.started,
          ended: r.ended,
          scheduled: r.created,
          layer_index: r.layer_index || 0,
          duration: r.duration,
          contract_id: r.contract_id,
          errored: r.errored,
          contextId: r.context_id,
          inputContext: r.inputContext,
          outputContext: r.outputContext,
        }));

        // Map for routine map display
        const routineMap = filteredData.map((r: any) => ({
          ...r,
          layer_index: r.layer_index || 0,
          errored: r.status === 'Errored',
          previousTaskExecutionId: r.previousRoutineExecution,
          inputContext: r.inputContext,
          outputContext: r.outputContext,
          description: r.routineDescription,
        }));

        return {
          routines,
          routineMap,
        };
      }

      // If uuid is provided, return the single routine (or null)
      if (uuid) {
        return data.length > 0 ? data[0] : null;
      }

      // Default response for other uses
      return data;
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
