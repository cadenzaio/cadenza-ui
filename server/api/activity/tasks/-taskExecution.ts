import { supabaseAdmin } from '~/utils/supabase';
import { removeMetaData } from '~/src/util';

/**
 * Represents a generic context object for task execution.
 */
type TaskContext = Record<string, unknown>;

/**
 * Raw database row structure for task execution query
 */
interface TaskExecutionRow {
  uuid: string;
  routine_execution_name: string;
  task_name: string;
  is_running: boolean;
  is_complete: boolean;
  errored: boolean;
  failed: boolean;
  progress: number;
  scheduled: Date;
  started: Date | null;
  ended: Date | null;
  previous_task_execution_ids: string[] | null;
  previous_task_names: string[] | null;
  next_task_execution_ids: string[] | null;
  next_task_names: string[] | null;
  service_name: string;
  routine_name: string;
  context_id: string | null;
  result_context_id: string | null;
  input_context: TaskContext;
  output_context: TaskContext;
  name: string;
  description: string;
  is_unique: boolean;
  function_string: string;
  processing_graph: string;
  address: string;
  port: number;
}

/**
 * Formatted response structure for task execution
 */
interface TaskExecutionResponse {
  uuid: string;
  routineExecutionName: string;
  taskName: string;
  isRunning: boolean;
  isComplete: boolean;
  errored: boolean;
  failed: boolean;
  progress: string;
  scheduled: Date;
  started: Date | null;
  ended: Date | null;
  inputContext: TaskContext;
  outputContext: TaskContext;
  inputContextId: string | null;
  outputContextId: string | null;
  name: string;
  description: string;
  isUnique: boolean;
  previousTaskExecutionId: string[] | null;
  previousTaskNames: string[] | null;
  nextTaskExecutionId: string[] | null;
  nextTaskNames: string[] | null;
  serverId: string;
  routineName: string;
  serverName: string;
  function_string: string;
  contract_id: string;
}

/**
 * SQL query for fetching task execution with related data
 */
const TASK_EXECUTION_QUERY = `
SELECT
    te.uuid,
    te.routine_execution_name,
    te.task_name,
    te.is_running,
    te.is_complete,
    te.errored,
    te.failed,
    te.progress,
    te.created AS scheduled,
    te.started,
    te.ended,
    prev.previous_task_execution_ids,
    prev.previous_task_names,
    nxt.next_task_execution_ids,
    nxt.next_task_names,
    re.service_name,
    re.description AS routine_name,
    ctx.uuid AS context_id,
    ctx2.uuid AS result_context_id,
    ctx.context AS input_context,
    ctx2.context AS output_context,
    t.name,
    t.description,
    t.is_unique,
    t.function_string,
    s.service_name,
    s.address,
    s.port
FROM task_execution te

-- Subquery for previous tasks
LEFT JOIN LATERAL (
    SELECT
        ARRAY_AGG(tem.previous_task_execution_id) AS previous_task_execution_ids,
        ARRAY_AGG(t_prev.name) AS previous_task_names
    FROM task_execution_map tem
    LEFT JOIN task_execution te_prev ON tem.previous_task_execution_id = te_prev.uuid
    LEFT JOIN task t_prev ON te_prev.task_id = t_prev.uuid
    WHERE tem.task_execution_id = te.uuid
) prev ON TRUE

-- Subquery for next tasks
LEFT JOIN LATERAL (
    SELECT
        ARRAY_AGG(tem2.task_execution_id) AS next_task_execution_ids,
        ARRAY_AGG(t_next.name) AS next_task_names
    FROM task_execution_map tem2
    LEFT JOIN task_execution te_next ON tem2.task_execution_id = te_next.uuid
    LEFT JOIN task t_next ON te_next.task_id = t_next.uuid
    WHERE tem2.previous_task_execution_id = te.uuid
) nxt ON TRUE

-- The rest of the joins
LEFT JOIN routine_execution re ON te.routine_execution_id = re.uuid
LEFT JOIN context ctx ON te.context_id = ctx.uuid
LEFT JOIN context ctx2 ON te.result_context_id = ctx2.uuid
LEFT JOIN task t ON te.task_id = t.uuid
LEFT JOIN server s ON re.server_id = s.uuid

WHERE te.uuid = $1
`;

/**
 * Validates if the provided task execution ID is a valid UUID format
 */
function validateTaskExecutionId(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function transformTaskExecutionData(
  row: any
): TaskExecutionResponse {
  return {
    uuid: row.uuid,
    routineExecutionName: row.routine_execution_name,
    taskName: row.task_name,
    isRunning: row.is_running,
    isComplete: row.is_complete,
    errored: row.errored,
    failed: row.failed,
    progress: (row.progress * 100).toFixed(0),
    scheduled: row.scheduled,
    started: row.started,
    ended: row.ended,
    inputContext: removeMetaData(row.input_context),
    outputContext: removeMetaData(row.output_context),
    inputContextId: row.context_id,
    outputContextId: row.result_context_id,
    name: row.name,
    description: row.description,
    isUnique: row.is_unique,
    previousTaskExecutionId: row.previous_task_execution_ids,
    previousTaskNames: row.previous_task_names,
    nextTaskExecutionId: row.next_task_execution_ids,
    nextTaskNames: row.next_task_names,
    serverId: row.service_name, // Using service_name as serverId
    routineName: row.routine_name,
    serverName: row.address, // Using address as serverName
    function_string: row.function_string,
    contract_id: '', // Not available in RPC, set to empty
  };
}

/**
 * Ensures database client is initialized
 */
async function ensureClient() {
  return supabaseAdmin;
}

/**
 * Fetches a task execution by ID from the database
 * @param taskExecutionId - The UUID of the task execution to fetch
 * @returns Promise<TaskExecutionResponse | null> - The task execution data or null if not found
 * @throws Error if database query fails
 */
async function getTaskExecution(
  taskExecutionId: string
): Promise<TaskExecutionResponse | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_task_execution_details', {
      task_execution_uuid: taskExecutionId
    });

    if (error) {
      console.error('Error executing task execution query:', error);
      throw new Error('Failed to fetch TaskExecution from the database.');
    }

    if (!data || data.length === 0) {
      return null;
    }

    return transformTaskExecutionData(data[0]);
  } catch (error) {
    console.error('Error executing task execution query:', error);
    throw new Error('Failed to fetch TaskExecution from the database.');
  }
}

/**
 * Event handler for task execution API endpoint
 */
export default defineEventHandler(async (event) => {
  try {
    // Only support GET method
    assertMethod(event, 'GET');

    // Extract task execution ID from query parameters
    const query = getQuery(event);
    const taskExecutionId = query.id as string;

    // Validate required parameter
    if (!taskExecutionId) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Task execution ID is required as a query parameter "id"',
      });
    }

    // Validate UUID format
    if (!validateTaskExecutionId(taskExecutionId)) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Invalid task execution ID format. Must be a valid UUID.',
      });
    }

    // Fetch task execution data
    const taskExecution = await getTaskExecution(taskExecutionId);

    if (!taskExecution) {
      throw createError({
        statusCode: 404,
        statusMessage: `Task execution with ID ${taskExecutionId} not found`,
      });
    }

    return taskExecution;
  } catch (error) {
    // Re-throw createError instances to preserve status codes
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    // Log unexpected errors and return generic 500 error
    console.error('Unexpected error in task execution endpoint:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error while fetching task execution',
    });
  }
});
