import { supabaseAdmin } from '~/utils/supabase';

interface RoutineExecutionTimeRow {
  started: string | Date;
  hour: number;
  date: string | Date;
  slowest_time: number;
  fastest_time: number;
  average_time: number;
}

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

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const routineName = url.searchParams.get('routineName');

  if (method === 'GET' && routineName) {
    try {
      console.log('Routine name:', routineName);
      const rows = await getRoutineExecutionTimes(routineName);
      console.log('Query result rows:', rows);

      if (!rows || rows.length === 0) {
        console.warn('No data found for routine:', routineName);
        return { series: [] };
      }

      const seriesData = rows.map((item: RoutineExecutionTimeRow) => ({
        date: item.started ? new Date(item.started).toISOString() : null,
        fastest: item.fastest_time != null ? parseFloat(item.fastest_time as unknown as string) : null,
        average: item.average_time != null ? parseFloat(item.average_time as unknown as string) : null,
        slowest: item.slowest_time != null ? parseFloat(item.slowest_time as unknown as string) : null,
      })).filter(item => item.date !== null);

      console.log('Mapped series data:', seriesData);
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
