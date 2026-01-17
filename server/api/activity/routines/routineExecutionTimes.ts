import { supabaseAdmin } from '~/utils/supabase';

// Type for routine execution time row
interface RoutineExecutionTimeRow {
  started: string | Date;
  hour: number;
  date: string | Date;
  slowest_time: number;
  fastest_time: number;
  average_time: number;
}

// Get RoutineExecutions by routine_id
async function getRoutineExecutionTimes(
  routineName: string
): Promise<RoutineExecutionTimeRow[]> {
  const { data, error } = await supabaseAdmin.rpc('get_routine_execution_times', {
    routine_name: routineName
  });
  if (error) {
    console.error('Error executing query:', error);
    throw error;
  }
  return data;
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const routineName = url.searchParams.get('routineName');

  if (method === 'GET' && routineName) {
    try {
      const rows = await getRoutineExecutionTimes(routineName);
      if (!rows || rows.length === 0) {
        return { series: [] };
      }
      const seriesData = rows.map((item: RoutineExecutionTimeRow) => {
        const started = item.started ? new Date(item.started).getTime() : 0;
        return {
          date: started,
          fastest: Number(item.fastest_time),
          average: Number(item.average_time),
          slowest: Number(item.slowest_time),
        };
      });
      return {
        series: [
          {
            name: 'Slowest',
            data: seriesData.map((item) => [item.date, item.slowest]),
          },
          {
            name: 'Average',
            data: seriesData.map((item) => [item.date, item.average]),
          },
          {
            name: 'Fastest',
            data: seriesData.map((item) => [item.date, item.fastest]),
          },
        ],
      };
    } catch (error) {
      console.error('Error fetching RoutineExecutionTimes:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineName });
    return { error: 'Invalid request' };
  }
});
