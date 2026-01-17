import { supabaseAdmin } from '~/utils/supabase';
import { formatDate, getDuration } from '~/server/api/utils';
import { removeMetaData } from '~/src/util';

// Types for routine row and mapped object
interface RoutineRow {
  uuid: string;
  execution_trace_id?: string;
  description: string;
  service_id: string;
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
  input_context: Record<string, unknown>;
  output_context: Record<string, unknown>;
  processing_graph: string;
  address: string;
  port: string;
  previous_routine_id: string;
  routine_name: string;
  routine_description: string;
  service_name: string;
}

interface RoutineMapped {
  id: string;
  name: string;
  type: string;
  label: string;
  description: string;
  routineDescription: string;
  serviceId: string;
  routineId: string;
  status: string;
  previousRoutineExecution: string;
  progress: number;
  started: string;
  ended: string;
  duration: number;
  uuid: string;
  serviceName: string;
  previousRoutineName: string;
  contract_id: string;
  processingGraph: string;
  inputContext: Record<string, unknown>;
  outputContext: Record<string, unknown>;
  isRunning: boolean;
  referer: string | null;
  executionTraceId?: string | null;
}

// Get all routines or a single routine by uuid
async function getRoutines({
  uuid,
  page = 1,
  limit = 50,
}: {
  uuid?: string;
  page?: number;
  limit?: number;
}): Promise<RoutineMapped[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_active_routines', {
      uuid_param: uuid || null,
      page_param: page,
      limit_param: limit
    });

    if (error) {
      throw error;
    }

    return data.map(
      (row: any): RoutineMapped => ({
        id: row.uuid,
        name: row.routine_name,
        type: 'routine',
        label: row.routine_name,
        description: row.routine_description,
        routineDescription: row.routine_description,
        serviceId: row.service_id,
        routineId: row.uuid,
        status: row.is_complete
          ? 'check'
          : row.is_running
          ? 'play_arrow'
          : row.errored
          ? 'close'
          : 'schedule',
        previousRoutineExecution: row.previous_routine_execution,
        progress: row.progress,
        started: row.created
          ? formatDate(
              typeof row.created === 'string'
                ? row.created
                : row.created.toISOString()
            )
          : '',
        ended: row.ended
          ? formatDate(
              typeof row.ended === 'string'
                ? row.ended
                : row.ended.toISOString()
            )
          : '',
        duration: getDuration(
          row.created
            ? typeof row.created === 'string'
              ? new Date(row.created).getTime()
              : row.created.getTime()
            : 0,
          row.ended
            ? typeof row.ended === 'string'
              ? new Date(row.ended).getTime()
              : row.ended.getTime()
            : 0
        ),
        uuid: row.uuid,
        serviceName: row.service_name,
        previousRoutineName: row.routine_name,
        executionTraceId: row.execution_trace_id || null,
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
