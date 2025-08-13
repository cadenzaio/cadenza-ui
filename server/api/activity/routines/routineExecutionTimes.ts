import { initializeClient } from '~/server/api/utils';
import { Client } from 'pg';

let client: Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

// Get RoutineExecutions by routine_id
async function getRoutineExecutionTimes(routineId: string) {
  const query = `
 SELECT
      MIN(re.created) as started,
      EXTRACT(hour FROM created) as hour,
      DATE_TRUNC('day', created, 'UTC') as date,
      MAX(EXTRACT(EPOCH FROM (ended - created))) as slowest_time,
      MIN(EXTRACT(EPOCH FROM (ended - created))) as fastest_time,
      AVG(EXTRACT(EPOCH FROM (ended - created))) as average_time
    FROM routine_execution as re
    WHERE routine_id = $1
    GROUP BY date, hour
    ORDER BY started
  `;
  const client = await getClient();
  try {
    const result = await client.query(query, [routineId]);
    return result.rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Event handler
export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const url = new URL(
    event.node.req.url ?? '',
    `http://${event.node.req.headers.host}`
  );
  const routineId = url.searchParams.get('routineId');

  if (method === 'GET' && routineId) {
    try {
      const rows = await getRoutineExecutionTimes(routineId);
      if (!rows || rows.length === 0) {
        return { series: [] };
      }
      // Map to chart series format
      const seriesData = rows.map((item: any) => ({
        date: new Date(item.started).toISOString(),
        fastest: parseFloat(item.fastest_time),
        average: parseFloat(item.average_time),
        slowest: parseFloat(item.slowest_time),
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
      console.error('Error fetching RoutineExecutionTimes:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineId });
    return { error: 'Invalid request' };
  }
});
