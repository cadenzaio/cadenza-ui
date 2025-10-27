import { initializeClient } from '~/server/api/utils';
import { Client } from 'pg';

let client: Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

// Type for execution time row
interface ExecutionTime {
  date: string | Date;
  hour: number;
  executions: number;
  total_execution_time: number;
  slowest_time: number;
  fastest_time: number;
  average_time: number;
}

// Get RoutineExecutions by routine_id
async function getRoutineExecutionTimes(
  routineId: string
): Promise<ExecutionTime[]> {
  const query = `
 SELECT
      MIN(re.created) as started,
      EXTRACT(hour FROM created) as hour,
      DATE_TRUNC('day', created, 'UTC') as date,
      COUNT(*) as executions,
      SUM(EXTRACT(EPOCH FROM (ended - created))) as total_execution_time,
      MAX(EXTRACT(EPOCH FROM (ended - created))) as slowest_time,
      MIN(EXTRACT(EPOCH FROM (ended - created))) as fastest_time,
      AVG(EXTRACT(EPOCH FROM (ended - created))) as average_time
    FROM routine_execution as re
    WHERE routine_id = $1 AND is_meta = false
    GROUP BY date, hour
    ORDER BY started
  `;
  const client = await getClient();
  try {
    const result = await client.query(query, [routineId]);
    // Map the results to match the expected ExecutionTime interface
    return result.rows.map(
      (row: any): ExecutionTime => ({
        date: row.date,
        hour: parseInt(row.hour),
        executions: parseInt(row.executions),
        total_execution_time: parseFloat(row.total_execution_time),
        slowest_time: parseFloat(row.slowest_time),
        fastest_time: parseFloat(row.fastest_time),
        average_time: parseFloat(row.average_time),
      })
    );
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
      return await getRoutineExecutionTimes(routineId);
    } catch (error) {
      console.error('Error fetching RoutineExecutionTimes:', error);
      throw error;
    }
  } else {
    console.error('Invalid request:', { method, routineId });
    return { error: 'Invalid request' };
  }
});
