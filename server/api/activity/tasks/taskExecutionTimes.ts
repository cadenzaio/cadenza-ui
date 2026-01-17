import { supabaseAdmin } from '~/utils/supabase';

// Type for task execution time row
interface TaskExecutionTimeRow {
  started: string | Date;
  hour: number;
  date: string | Date;
  slowest_time: number;
  fastest_time: number;
  average_time: number;
}

// Get TaskExecutions by task_name
async function getTaskMap(taskName: string): Promise<TaskExecutionTimeRow[]> {
  const { data, error } = await supabaseAdmin.rpc('get_activity_task_execution_times', {
    task_name: taskName
  });

  if (error) {
    throw error;
  }

  return data as TaskExecutionTimeRow[];
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const taskName = url.searchParams.get('taskName');

  if (method === 'GET' && taskName) {
    try {
      const rows = await getTaskMap(taskName);
      if (!rows || rows.length === 0) {
        return { series: [] };
      }
      // Map to chart series format
      const seriesData = rows.map((item: TaskExecutionTimeRow) => ({
        date: new Date(item.started).toISOString(),
        fastest: parseFloat(item.fastest_time as unknown as string),
        average: parseFloat(item.average_time as unknown as string),
        slowest: parseFloat(item.slowest_time as unknown as string),
      }));
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
      console.error('Error fetching TaskExecutions:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, taskName });
    return { error: 'Invalid request' };
  }
});
