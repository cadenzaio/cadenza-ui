import { supabaseAdmin } from '~/utils/supabase';
import { formatDate, getDuration } from '~/server/api/utils';
import { removeMetaData } from '~/src/util';

// Types for routine row and mapped object
interface RoutineRow {
  name: string;
  description: string;
  service_id: string;
  routine_id: string;
  uuid: string;
  is_running: boolean;
  is_complete: boolean;
  errored: boolean;
  failed: boolean;
  previous_routine_execution: string;
  progress: number;
  created: string | Date;
  started: string | Date;
  ended: string | Date;
  trace_id: string;
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
  progress: string;
  started: string;
  ended: string;
  duration: number;
  serviceName: string; 
  previousRoutineName: string;
  trace_id: string;
  processingGraph: string;
  inputContext: Record<string, unknown>;
  outputContext: Record<string, unknown>;
  isRunning: boolean;
  referer: string | null;
}

// Get all routines or a single routine by name
async function getRoutines({
  name,
  page = 1,
  limit = 50,
}: {
  name?: string;
  page?: number;
  limit?: number;
}): Promise<RoutineMapped[]> {
  const { data, error } = await supabaseAdmin.rpc('get_routine_activity', {
    routine_name: name || null,
    page_val: page,
    limit_val: limit
  });

  if (error) {
    console.error('Error executing query:', error);
    throw error;
  }

  return data.map((row: any): RoutineMapped => ({
    id: row.name,
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
    progress: parseFloat((row.progress * 100).toFixed(2)) + '%',
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
    serviceName: row.service_name,
    previousRoutineName: row.routine_name,
    trace_id: '', // Not available in RPC
    processingGraph: '', // Not available in RPC
    inputContext: {}, // Not available in RPC
    outputContext: {}, // Not available in RPC
    isRunning: row.is_running,
    referer: row.errored ? 'Errored' : null,
  }));
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
    const traceId = urlParams.get('traceId') || undefined;

    try {
      const name = urlParams.get('name') || undefined;
      const data = await getRoutines({ name, page, limit });

      // If traceId is provided, filter and return mapped data for contract page
      if (traceId) {
        const filteredData = data.filter(
          (r: RoutineMapped) => r.trace_id === traceId
        );

        // Map for table display
        const routines = filteredData.map((r) => ({
          name: r.name,
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
          trace_id: r.trace_id,
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

      // If name is provided, return the single routine (or null)
      if (name) {
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
