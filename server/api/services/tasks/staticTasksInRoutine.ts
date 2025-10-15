import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

// Type for routine task row
interface RoutineTask {
  name: string;
  label: string;
  layer_index: number;
  previousTaskExecutionName: string | null;
  description: string;
  is_unique: boolean;
  concurrency: number;
}

// Get all routines
async function getRoutineMap(routineName: string): Promise<RoutineTask[]> {
  const query = `
SELECT
    ttrm.routine_name,
    ttrm.task_name AS name,
    t.name,
    t.layer_index,
    t.description,
    t.is_unique,
    t.concurrency,
    dtm.task_name,
    dtm.predecessor_task_name AS previous_task_execution_name
FROM task_to_routine_map ttrm
LEFT OUTER JOIN task t ON ttrm.task_name = t.name
LEFT OUTER JOIN directional_task_graph_map dtm ON ttrm.task_name = dtm.task_name
Where routine_name = $1 ;
  `;
  const result = await client!.query(query, [routineName]);

  // Map the results to match the expected format (restore to original)
  return result.rows.map(
    (task: any): RoutineTask => ({
      name: task.name,
      label: task.name,
      layer_index: task.layer_index,
      previousTaskExecutionName: task.previous_task_execution_name,
      description: task.description,
      is_unique: task.is_unique,
      concurrency: task.concurrency,
    })
  );
}

// Event handler
export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method, url } = event.node.req;
  const routineName = url?.split('=')[1];

  if (method === 'GET') {
    try {
      return await getRoutineMap(routineName ?? '');
    } catch (error) {
      console.error('Error fetching routines:', error);
      throw error;
    }
  }
});
