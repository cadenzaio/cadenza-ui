import pg from 'pg';
import { initializeClient, formatDate, getDuration } from '~/server/api/utils';
import { removeMetaData } from '~/src/util';

let client: pg.Client | null = null;

// Types for routine row and mapped object
interface RoutineRow {
  uuid: string;
  description: string;
  server_id: string;
  routine_id: string;
  is_running: boolean;
  is_complete: boolean;
  errored: boolean;
  failed: boolean;
  previous_routine_execution: string;
  progress: number;
  created: string | Date;
  ended: string | Date;
  contract_id: string;
  context_id: string;
  result_context_id: string;
  input_context: Record<string, unknown>;
  output_context: Record<string, unknown>;
  processing_graph: string;
  address: string;
  port: string;
  previous_routine_id: string;
  routine_name: string;
  routine_description: string;
}

interface RoutineMapped {
  id: string;
  name: string;
  type: string;
  label: string;
  description: string;
  routineDescription: string;
  serverId: string;
  routineId: string;
  status: string;
  previousRoutineExecution: string;
  progress: number;
  started: string;
  ended: string;
  duration: number;
  uuid: string;
  serverName: string;
  previousRoutineName: string;
  contract_id: string;
  processingGraph: string;
  inputContext: Record<string, unknown>;
  outputContext: Record<string, unknown>;
  isRunning: boolean;
  referer: string | null;
}

// Get all routines
async function getRoutines(
  id: string,
  page: number = 1,
  limit: number = 50
): Promise<RoutineMapped[]> {
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
    where re.routine_id = $1
    ORDER BY re.created DESC
  `;

  try {
    const res = await client.query(query, [id]);

    // Map the results - ensuring all fields needed by frontend are included
    return res.rows.map(
      (row: RoutineRow): RoutineMapped => ({
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
        started: formatDate(
          typeof row.created === 'string'
            ? row.created
            : row.created.toISOString()
        ),
        ended: formatDate(
          typeof row.ended === 'string' ? row.ended : row.ended.toISOString()
        ),
        duration: getDuration(
          typeof row.created === 'string'
            ? new Date(row.created).getTime()
            : row.created.getTime(),
          typeof row.ended === 'string'
            ? new Date(row.ended).getTime()
            : row.ended.getTime()
        ),
        uuid: row.uuid,
        serverName: row.processing_graph + '@' + row.address + ':' + row.port,
        previousRoutineName: row.routine_name,
        contract_id: row.contract_id,
        processingGraph: row.processing_graph,
        inputContext: removeMetaData(row.input_context),
        outputContext: removeMetaData(row.output_context),
        isRunning: row.is_running,
        referer: row.errored ? 'Errored' : null,
      })
    );
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

    // Extract routine ID from query parameters
    const id = urlParams.get('id');

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Routine ID is required',
      });
    }

    try {
      const data = await getRoutines(id);

      // If contractId is provided, filter and return mapped data for contract page
      if (contractId) {
        const filteredData = data.filter(
          (r: RoutineMapped) => r.contract_id === contractId
        );

        // Map for table display
        const routines = filteredData.map((r) => ({
          uuid: r.uuid,
          label: r.label,
          description: r.routineDescription,
          status: r.isRunning
            ? 'play_arrow'
            : r.status === 'check'
            ? 'check'
            : 'schedule',
          progress: r.progress,
          started: r.started,
          ended: r.ended,
          scheduled: r.started,
          layer_index: (r as any).layer_index || 0,
          duration: r.duration,
          contract_id: r.contract_id,
          errored: r.referer === 'Errored',
          contextId: (r as any).context_id,
          inputContext: r.inputContext,
          outputContext: r.outputContext,
        }));

        // Map for routine map display
        const routineMap = filteredData.map((r) => ({
          ...r,
          layer_index: (r as any).layer_index || 0,
          errored: r.referer === 'Errored',
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

      // Default response for other uses
      return data;
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
