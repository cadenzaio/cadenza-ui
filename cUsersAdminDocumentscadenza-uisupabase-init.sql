-- Create RPC function for task execution details by ID
CREATE OR REPLACE FUNCTION get_task_execution_details(execution_id_param text)
RETURNS TABLE (
    name text,
    description text,
    layer_index integer,
    is_unique boolean,
    concurrency integer,
    service_name text,
    version text,
    uuid text,
    routine_execution_id text,
    context jsonb,
    meta_context jsonb,
    result_context jsonb,
    meta_result_context jsonb,
    service_instance_id text,
    execution_trace_id text,
    is_scheduled boolean,
    is_running boolean,
    is_complete boolean,
    is_meta boolean,
    errored boolean,
    failed boolean,
    reached_timeout boolean,
    error_message text,
    progress numeric,
    created timestamp with time zone,
    started timestamp with time zone,
    ended timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.task_name,
        NULL::text as description,
        NULL::integer as layer_index,
        NULL::boolean as is_unique,
        NULL::integer as concurrency,
        te.service_name,
        te.task_version,
        te.uuid,
        te.routine_execution_id,
        te.context,
        te.meta_context,
        te.result_context,
        te.meta_result_context,
        te.service_instance_id,
        te.execution_trace_id,
        te.is_scheduled,
        te.is_running,
        te.is_complete,
        te.is_meta,
        te.errored,
        te.failed,
        te.reached_timeout,
        te.error_message,
        te.progress,
        te.created,
        te.started,
        te.ended
    FROM task_execution te
    WHERE te.uuid = execution_id_param
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_execution_details(text) TO anon;
