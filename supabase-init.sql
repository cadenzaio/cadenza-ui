-- Create RPC function for routine execution stats
CREATE OR REPLACE FUNCTION get_routine_execution_stats()
RETURNS TABLE (
    executions bigint,
    errored bigint,
    failed bigint,
    reached_timeout bigint,
    is_complete bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as executions,
        SUM(CASE WHEN errored THEN 1 ELSE 0 END) as errored,
        SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as reached_timeout,
        SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) as is_complete
    FROM
        routine_execution;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for routine execution stats by name
CREATE OR REPLACE FUNCTION get_routine_execution_stats_by_name(routine_name text)
RETURNS TABLE (
    executions bigint,
    errored bigint,
    failed bigint,
    reached_timeout bigint,
    is_complete bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as executions,
        SUM(CASE WHEN errored THEN 1 ELSE 0 END) as errored,
        SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as reached_timeout,
        SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) as is_complete
    FROM
        routine_execution
    WHERE
        name = routine_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routine_execution_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_routine_execution_stats_by_name(text) TO anon;

-- Create RPC function for task execution stats by name
CREATE OR REPLACE FUNCTION get_task_execution_stats_by_name(task_name text)
RETURNS TABLE (
    executions bigint,
    errored bigint,
    failed bigint,
    reached_timeout bigint,
    is_complete bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as executions,
        SUM(CASE WHEN errored THEN 1 ELSE 0 END) as errored,
        SUM(CASE WHEN failed THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN reached_timeout THEN 1 ELSE 0 END) as reached_timeout,
        SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) as is_complete
    FROM
        task_execution
    WHERE
        task_name = task_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_execution_stats_by_name(text) TO anon;

-- Create RPC function for task execution times
CREATE OR REPLACE FUNCTION get_task_execution_times(task_id text)
RETURNS TABLE (
    started timestamp with time zone,
    hour double precision,
    date date,
    slowest_time double precision,
    fastest_time double precision,
    average_time double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        MIN(te.started) as started,
        EXTRACT(hour FROM MIN(te.started)) as hour,
        DATE_TRUNC('day', MIN(te.started))::date as date,
        MAX(EXTRACT(EPOCH FROM (te.ended - te.started))) as slowest_time,
        MIN(EXTRACT(EPOCH FROM (te.ended - te.started))) as fastest_time,
        AVG(EXTRACT(EPOCH FROM (te.ended - te.started))) as average_time
    FROM task_execution as te
    WHERE te.task_name = task_id
    GROUP BY DATE_TRUNC('day', te.started), EXTRACT(hour FROM te.started)
    ORDER BY MIN(te.started);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_execution_times(text) TO anon;

-- Create RPC function for task heatmap data
CREATE OR REPLACE FUNCTION get_task_heatmap_data(task_name text)
RETURNS TABLE (
    date date,
    hour double precision,
    executions bigint,
    errors bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('day', te.created)::date as date,
        EXTRACT(hour FROM te.created) as hour,
        COUNT(*) as executions,
        SUM(CASE WHEN te.errored THEN 1 ELSE 0 END) +
        SUM(CASE WHEN te.failed THEN 1 ELSE 0 END) +
        SUM(CASE WHEN te.reached_timeout THEN 1 ELSE 0 END) as errors
    FROM task_execution te
    WHERE te.task_name = task_name
    GROUP BY DATE_TRUNC('day', te.created), EXTRACT(hour FROM te.created)
    ORDER BY DATE_TRUNC('day', te.created), EXTRACT(hour FROM te.created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_heatmap_data(text) TO anon;

-- Create RPC function for meta service nodes and edges
CREATE OR REPLACE FUNCTION get_meta_service_graph(service_name text, limit_val integer DEFAULT 0, offset_val integer DEFAULT 0)
RETURNS TABLE (
    task_name text,
    task_description text,
    layer_index integer,
    is_unique boolean,
    concurrency integer,
    service_name text,
    version integer,
    previous_task_execution_name text,
    previous_task_service_name text,
    previous_task_version integer,
    emits text[],
    signals_to_emit_after text[],
    signals_to_emit_on_fail text[],
    observed text[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name AS task_name,
        t.description AS task_description,
        t.layer_index,
        t.is_unique,
        t.concurrency,
        t.service_name,
        t.version,
        dtm.predecessor_task_name AS previous_task_execution_name,
        dtm.predecessor_service_name AS previous_task_service_name,
        dtm.predecessor_task_version AS previous_task_version,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(t.signals->'emits', '[]'::jsonb))) AS emits,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(t.signals->'signalsToEmitAfter', '[]'::jsonb))) AS signals_to_emit_after,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(t.signals->'signalsToEmitOnFail', '[]'::jsonb))) AS signals_to_emit_on_fail,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(t.signals->'observed', '[]'::jsonb))) AS observed
    FROM task t
    LEFT JOIN directional_task_graph_map dtm
        ON t.name = dtm.task_name
        AND t.version = dtm.task_version
        AND t.service_name = dtm.service_name
    WHERE t.service_name = service_name AND t.is_meta = true
        AND (t.deleted IS FALSE OR t.deleted IS NULL)
    ORDER BY t.name
    LIMIT CASE WHEN limit_val > 0 THEN limit_val ELSE NULL END
    OFFSET offset_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_meta_service_graph(text, integer, integer) TO anon;

-- Create RPC function for tasks that emit a signal
CREATE OR REPLACE FUNCTION get_tasks_emitting_signal(signal_name text)
RETURNS TABLE (
    task_name text,
    task_description text,
    service_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        t.name,
        t.description,
        t.service_name
    FROM task t
    WHERE t.signals->'emits' ? signal_name AND t.is_meta = true
    ORDER BY t.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function for tasks that observe a signal
CREATE OR REPLACE FUNCTION get_tasks_observing_signal(signal_name text)
RETURNS TABLE (
    task_name text,
    task_description text,
    service_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        t.name,
        t.description,
        t.service_name
    FROM task t
    WHERE t.signals->'observed' ? signal_name AND t.is_meta = true
    ORDER BY t.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_tasks_emitting_signal(text) TO anon;
-- Create RPC function for activity task execution times
CREATE OR REPLACE FUNCTION get_activity_task_execution_times(task_name text)
RETURNS TABLE (
    started timestamp with time zone,
    hour double precision,
    date date,
    slowest_time double precision,
    fastest_time double precision,
    average_time double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        MIN(te.started) as started,
        EXTRACT(hour FROM MIN(te.started)) as hour,
        DATE_TRUNC('day', MIN(te.started))::date as date,
        MAX(EXTRACT(EPOCH FROM (te.ended - te.started))) as slowest_time,
        MIN(EXTRACT(EPOCH FROM (te.ended - te.started))) as fastest_time,
        AVG(EXTRACT(EPOCH FROM (te.ended - te.started))) as average_time
    FROM task_execution te
    WHERE te.task_name = task_name
        AND te.started IS NOT NULL
        AND te.ended IS NOT NULL
    GROUP BY DATE_TRUNC('day', te.started), EXTRACT(hour FROM te.started)
    ORDER BY MIN(te.started);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_activity_task_execution_times(text) TO anon;GRANT EXECUTE ON FUNCTION get_tasks_observing_signal(text) TO anon;

-- Create RPC function for routine heatmap data
CREATE OR REPLACE FUNCTION get_routine_heatmap_data()
RETURNS TABLE (
    date date,
    hour double precision,
    executions bigint,
    errors bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('day', re.created)::date as date,
        EXTRACT(hour FROM re.created) as hour,
        COUNT(*) as executions,
        SUM(CASE WHEN re.errored THEN 1 ELSE 0 END) +
        SUM(CASE WHEN re.failed THEN 1 ELSE 0 END) +
        SUM(CASE WHEN re.reached_timeout THEN 1 ELSE 0 END) as errors
    FROM routine_execution re
    WHERE re.is_meta = false
    GROUP BY DATE_TRUNC('day', re.created), EXTRACT(hour FROM re.created)
    ORDER BY DATE_TRUNC('day', re.created), EXTRACT(hour FROM re.created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routine_heatmap_data() TO anon;

-- Create RPC function for service instance heatmap data
CREATE OR REPLACE FUNCTION get_service_instance_heatmap_data(service_instance_id text)
RETURNS TABLE (
    date date,
    hour double precision,
    executions bigint,
    errors bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('day', te.created)::date as date,
        EXTRACT(hour FROM te.created) as hour,
        COUNT(*) as executions,
        SUM(CASE WHEN te.errored THEN 1 ELSE 0 END) +
        SUM(CASE WHEN te.failed THEN 1 ELSE 0 END) +
        SUM(CASE WHEN te.reached_timeout THEN 1 ELSE 0 END) as errors
    FROM task_execution te
    WHERE te.is_meta = false AND te.service_instance_id = service_instance_id
    GROUP BY DATE_TRUNC('day', te.created), EXTRACT(hour FROM te.created)
    ORDER BY DATE_TRUNC('day', te.created), EXTRACT(hour FROM te.created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_service_instance_heatmap_data(text) TO anon;

-- Create RPC function for routine heatmap data by name
CREATE OR REPLACE FUNCTION get_routine_heatmap_data_by_name(routine_name text)
RETURNS TABLE (
    date date,
    hour double precision,
    executions bigint,
    errors bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('day', re.created)::date as date,
        EXTRACT(hour FROM re.created) as hour,
        COUNT(*) as executions,
        SUM(CASE WHEN re.errored THEN 1 ELSE 0 END) +
        SUM(CASE WHEN re.failed THEN 1 ELSE 0 END) +
        SUM(CASE WHEN re.reached_timeout THEN 1 ELSE 0 END) as errors
    FROM routine_execution re
    WHERE re.name = routine_name AND re.is_meta = false
    GROUP BY DATE_TRUNC('day', re.created), EXTRACT(hour FROM re.created)
    ORDER BY DATE_TRUNC('day', re.created), EXTRACT(hour FROM re.created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routine_heatmap_data_by_name(text) TO anon;

-- Create RPC function for routine execution times
CREATE OR REPLACE FUNCTION get_routine_execution_times(routine_name text)
RETURNS TABLE (
    started timestamp with time zone,
    hour double precision,
    date date,
    slowest_time double precision,
    fastest_time double precision,
    average_time double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        MIN(re.created) as started,
        EXTRACT(hour FROM re.created) as hour,
        DATE_TRUNC('day', re.created)::date as date,
        MAX(EXTRACT(EPOCH FROM (re.ended - re.created))) as slowest_time,
        MIN(EXTRACT(EPOCH FROM (re.ended - re.created))) as fastest_time,
        AVG(EXTRACT(EPOCH FROM (re.ended - re.created))) as average_time
    FROM routine_execution re
    WHERE re.name = routine_name
    GROUP BY DATE_TRUNC('day', re.created), EXTRACT(hour FROM re.created)
    ORDER BY MIN(re.created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routine_execution_times(text) TO anon;

-- Create RPC function for task execution details
CREATE OR REPLACE FUNCTION get_task_execution_details(task_execution_uuid text)
RETURNS TABLE (
    uuid text,
    routine_execution_name text,
    task_name text,
    is_running boolean,
    is_complete boolean,
    errored boolean,
    failed boolean,
    progress double precision,
    scheduled timestamp with time zone,
    started timestamp with time zone,
    ended timestamp with time zone,
    previous_task_execution_ids text[],
    previous_task_names text[],
    next_task_execution_ids text[],
    next_task_names text[],
    service_name text,
    routine_name text,
    context_id text,
    result_context_id text,
    input_context jsonb,
    output_context jsonb,
    name text,
    description text,
    is_unique boolean,
    function_string text,
    address text,
    port integer
) AS $$
BEGIN
    RETURN QUERY
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

    WHERE te.uuid = task_execution_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_execution_details(text) TO anon;

-- Create RPC function for task count by service instance
CREATE OR REPLACE FUNCTION get_task_count_by_service_instance(service_instance_id text)
RETURNS TABLE (
    started timestamp with time zone,
    count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('hour', te.started) as started,
        COUNT(*) as count
    FROM task_execution te
    WHERE te.is_meta = false AND te.service_instance_id = service_instance_id
    GROUP BY DATE_TRUNC('hour', te.started)
    ORDER BY DATE_TRUNC('hour', te.started);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_count_by_service_instance(text) TO anon;

-- Create RPC function for signal count by service instance
CREATE OR REPLACE FUNCTION get_signal_count_by_service_instance(service_instance_id text)
RETURNS TABLE (
    started timestamp with time zone,
    count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE_TRUNC('hour', se.emitted_at) as started,
        COUNT(*) as count
    FROM signal_emission se
    WHERE se.is_meta = false AND se.service_instance_id = service_instance_id
    GROUP BY DATE_TRUNC('hour', se.emitted_at)
    ORDER BY DATE_TRUNC('hour', se.emitted_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_signal_count_by_service_instance(text) TO anon;

-- Create RPC function for routine activity
CREATE OR REPLACE FUNCTION get_routine_activity(routine_name text DEFAULT NULL, page_val integer DEFAULT 1, limit_val integer DEFAULT 50)
RETURNS TABLE (
    uuid text,
    name text,
    routine_name text,
    service_id text,
    is_running boolean,
    is_complete boolean,
    errored boolean,
    failed boolean,
    progress double precision,
    created timestamp with time zone,
    started timestamp with time zone,
    ended timestamp with time zone,
    routine_type text,
    routine_description text,
    previous_routine_execution text,
    service_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        re.uuid,
        re.name,
        re.name AS routine_name,
        re.service_instance_id AS service_id,
        re.is_running,
        re.is_complete,
        re.errored,
        re.failed,
        re.progress,
        re.created,
        re.started,
        re.ended,
        r.name AS routine_type,
        r.description AS routine_description,
        re.previous_routine_execution,
        s.name AS service_name
    FROM routine_execution re
    LEFT JOIN routine r ON re.name = r.name AND re.service_name = r.service_name
    LEFT JOIN service s ON re.service_name = s.name
    WHERE (routine_name IS NULL OR re.name = routine_name)
    ORDER BY re.created DESC
    LIMIT limit_val
    OFFSET ((page_val - 1) * limit_val);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routine_activity(text, integer, integer) TO anon;

-- Create RPC function for routines with task
CREATE OR REPLACE FUNCTION get_routines_with_task(task_name text, page_val integer DEFAULT 1, limit_val integer DEFAULT 50)
RETURNS TABLE (
    name text,
    description text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.name,
        r.description
    FROM routine r
    JOIN task_to_routine_map trm ON r.name = trm.routine_name
    JOIN task t ON trm.task_name = t.name
    WHERE t.name = task_name
    ORDER BY r.name ASC
    LIMIT limit_val
    OFFSET ((page_val - 1) * limit_val);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routines_with_task(text, integer, integer) TO anon;

-- Create RPC function for non-meta services
CREATE OR REPLACE FUNCTION get_non_meta_services()
RETURNS TABLE (
    uuid text,
    name text,
    display_name text,
    description text,
    is_meta boolean,
    created timestamp with time zone,
    modified timestamp with time zone,
    deleted timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.uuid,
        s.name,
        s.display_name,
        s.description,
        s.is_meta,
        s.created,
        s.modified,
        s.deleted
    FROM service s
    WHERE s.is_meta = false
    ORDER BY s.modified DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_non_meta_services() TO anon;

-- Create RPC function for routines by service
CREATE OR REPLACE FUNCTION get_routines_by_service(service_name_param text)
RETURNS TABLE (
    name text,
    description text,
    service_name text,
    is_meta boolean,
    version integer,
    created timestamp with time zone,
    deleted timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.name,
        r.description,
        r.service_name,
        r.is_meta,
        r.version,
        r.created,
        r.deleted
    FROM routine r
    WHERE r.service_name = service_name_param
        AND r.is_meta = false
    ORDER BY r.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routines_by_service(text) TO anon;

-- Create RPC function for tasks by routine
CREATE OR REPLACE FUNCTION get_tasks_by_routine(routine_name_param text)
RETURNS TABLE (
    name text,
    description text,
    service_name text,
    layer_index integer,
    version integer,
    created timestamp with time zone,
    deleted timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name,
        t.description,
        t.service_name,
        t.layer_index,
        t.version,
        t.created,
        t.deleted
    FROM task_to_routine_map ttrm
    LEFT JOIN task t ON ttrm.task_name = t.name
    WHERE ttrm.routine_name = routine_name_param
        AND t.is_meta = false
    ORDER BY t.layer_index ASC, t.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_tasks_by_routine(text) TO anon;

-- Create RPC function for tasks by service
CREATE OR REPLACE FUNCTION get_tasks_by_service(service_name_param text)
RETURNS TABLE (
    name text,
    description text,
    service_name text,
    layer_index integer,
    version integer,
    created timestamp with time zone,
    deleted timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name,
        t.description,
        t.service_name,
        t.layer_index,
        t.version,
        t.created,
        t.deleted
    FROM task t
    WHERE t.service_name = service_name_param
        AND t.is_meta = false
    ORDER BY t.layer_index ASC, t.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_tasks_by_service(text) TO anon;

-- Create RPC function for tasks with signals
CREATE OR REPLACE FUNCTION get_tasks_with_signals(task_names text[])
RETURNS TABLE (
    name text,
    service_name text,
    signals jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name,
        t.service_name,
        t.signals
    FROM task t
    WHERE t.name = ANY(task_names) AND t.is_meta = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_tasks_with_signals(text[]) TO anon;

-- Create RPC function for external signal emitters
CREATE OR REPLACE FUNCTION get_external_signal_emitters(signal_names text[])
RETURNS TABLE (
    name text,
    service_name text,
    signals jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name,
        t.service_name,
        t.signals
    FROM task t
    WHERE t.signals->'emits' ?| signal_names;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_external_signal_emitters(text[]) TO anon;

-- Create RPC function for signal registry
CREATE OR REPLACE FUNCTION get_signal_registry(signal_names text[])
RETURNS TABLE (
    name text,
    domain text,
    action text,
    is_meta boolean,
    service_name text,
    created timestamp with time zone,
    deleted timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sr.name,
        sr.domain,
        sr.action,
        sr.is_meta,
        sr.service_name,
        sr.created,
        sr.deleted
    FROM signal_registry sr
    WHERE sr.name = ANY(signal_names) AND sr.is_meta = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_signal_registry(text[]) TO anon;

-- Create RPC function for directional task graph map
CREATE OR REPLACE FUNCTION get_directional_task_graph(task_names text[])
RETURNS TABLE (
    task_name text,
    predecessor_task_name text,
    task_version integer,
    predecessor_task_version integer,
    service_name text,
    predecessor_service_name text,
    execution_count integer,
    last_executed timestamp with time zone,
    deleted boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dtgm.task_name,
        dtgm.predecessor_task_name,
        dtgm.task_version,
        dtgm.predecessor_task_version,
        dtgm.service_name,
        dtgm.predecessor_service_name,
        dtgm.execution_count,
        dtgm.last_executed,
        dtgm.deleted
    FROM directional_task_graph_map dtgm
    WHERE (dtgm.task_name = ANY(task_names) OR dtgm.predecessor_task_name = ANY(task_names))
        AND dtgm.deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_directional_task_graph(text[]) TO anon;

-- Create RPC function for tasks in service with routines and signals
CREATE OR REPLACE FUNCTION get_tasks_in_service(service_name_param text)
RETURNS TABLE (
    task_name text,
    task_description text,
    layer_index integer,
    is_unique boolean,
    concurrency integer,
    service_name text,
    version text,
    signals jsonb,
    previous_task_execution_name text,
    routine_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name AS task_name,
        t.description AS task_description,
        t.layer_index,
        t.is_unique,
        t.concurrency,
        t.service_name,
        t.version,
        t.signals,
        dtm.predecessor_task_name AS previous_task_execution_name,
        r.name AS routine_name
    FROM task t
    LEFT JOIN directional_task_graph_map dtm
        ON t.name = dtm.task_name
        AND t.version = dtm.task_version
        AND t.service_name = dtm.service_name
    LEFT JOIN task_to_routine_map trm
        ON t.name = trm.task_name
        AND t.service_name = trm.service_name
    LEFT JOIN routine r
        ON trm.routine_name = r.name
    WHERE t.service_name = service_name_param AND t.is_meta = false
        AND (t.deleted IS FALSE OR t.deleted IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_tasks_in_service(text) TO anon;

-- Create RPC function for execution trace with all related data
CREATE OR REPLACE FUNCTION get_execution_trace(trace_uuid_param text)
RETURNS TABLE (
    trace_uuid text,
    trace_context jsonb,
    trace_meta_context jsonb,
    trace_created timestamp with time zone,
    issued_at timestamp with time zone,
    service_name text,
    routine_name text,
    routine_uuid text,
    task_name text,
    task_uuid text,
    task_created timestamp with time zone,
    task_started timestamp with time zone,
    task_ended timestamp with time zone,
    task_errored boolean,
    task_failed boolean,
    task_is_complete boolean,
    task_progress numeric,
    previous_task_execution_id text,
    signal_emission_uuid text,
    signal_emission_name text,
    signal_emitted_at timestamp with time zone,
    signal_consumption_uuid text,
    signal_consumption_name text,
    signal_consumed_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        et.uuid AS trace_uuid,
        et.context AS trace_context,
        et.meta_context AS trace_meta_context,
        et.created AS trace_created,
        et.issued_at AS issued_at,
        et.service_name,
        re.name AS routine_name,
        re.uuid AS routine_uuid,
        te.task_name,
        te.uuid AS task_uuid,
        te.created AS task_created,
        te.started AS task_started,
        te.ended AS task_ended,
        te.errored AS task_errored,
        te.failed AS task_failed,
        te.is_complete AS task_is_complete,
        te.progress AS task_progress,
        tem.previous_task_execution_id,
        se_emit.uuid AS signal_emission_uuid,
        se_emit.signal_name AS signal_emission_name,
        se_emit.emitted_at AS signal_emitted_at,
        se_consume.uuid AS signal_consumption_uuid,
        se_consume.signal_name AS signal_consumption_name,
        se_consume.emitted_at AS signal_consumed_at
    FROM execution_trace et
    LEFT JOIN routine_execution re
        ON et.uuid = re.execution_trace_id
    LEFT JOIN task_execution te
        ON re.uuid = te.routine_execution_id
    LEFT JOIN task_execution_map tem
        ON te.uuid = tem.task_execution_id
    LEFT JOIN signal_emission se_emit
        ON te.uuid = se_emit.task_execution_id AND se_emit.is_meta = false
    LEFT JOIN signal_emission se_consume
        ON te.signal_emission_id = se_consume.uuid AND se_consume.is_meta = false
    WHERE et.uuid = trace_uuid_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_execution_trace(text) TO anon;

-- Create RPC function for active routines
CREATE OR REPLACE FUNCTION get_active_routines(uuid_param text DEFAULT NULL, page_param integer DEFAULT 1, limit_param integer DEFAULT 50)
RETURNS TABLE (
    uuid text,
    execution_trace_id text,
    routine_name text,
    service_id text,
    is_running boolean,
    is_complete boolean,
    errored boolean,
    failed boolean,
    progress numeric,
    created timestamp with time zone,
    started timestamp with time zone,
    ended timestamp with time zone,
    input_context jsonb,
    output_context jsonb,
    routine_type text,
    routine_description text,
    previous_routine_execution text,
    service_name text,
    contract_id text,
    processing_graph text,
    address text,
    port text,
    previous_routine_id text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        re.uuid,
        re.execution_trace_id,
        re.name AS routine_name,
        re.service_instance_id AS service_id,
        re.is_running,
        re.is_complete,
        re.errored,
        re.failed,
        re.progress,
        re.created,
        re.started,
        re.ended,
        re.context AS input_context,
        re.result_context AS output_context,
        r.name AS routine_type,
        r.description AS routine_description,
        re.previous_routine_execution,
        s.name AS service_name,
        re.contract_id,
        re.processing_graph,
        si.address,
        si.port,
        re.previous_routine_id
    FROM routine_execution AS re
    LEFT JOIN routine r ON re.name = r.name AND re.service_name = r.service_name
    LEFT JOIN service s ON re.service_name = s.name
    LEFT JOIN service_instance si ON re.service_instance_id = si.uuid
    WHERE (uuid_param IS NULL OR re.uuid = uuid_param)
    ORDER BY re.created DESC
    LIMIT CASE WHEN uuid_param IS NOT NULL THEN NULL ELSE limit_param END
    OFFSET CASE WHEN uuid_param IS NOT NULL THEN 0 ELSE (page_param - 1) * limit_param END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_active_routines(text, integer, integer) TO anon;

-- Create RPC function for task details
CREATE OR REPLACE FUNCTION get_task_details(task_name_param text, version_param text DEFAULT NULL, service_param text DEFAULT NULL)
RETURNS TABLE (
    name text,
    description text,
    layer_index integer,
    is_unique boolean,
    concurrency integer,
    service_name text,
    version text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.name,
        t.description,
        t.layer_index,
        t.is_unique,
        t.concurrency,
        t.service_name,
        t.version
    FROM task t
    WHERE t.name = task_name_param
    AND (version_param IS NULL OR t.version = version_param)
    AND (service_param IS NULL OR t.service_name = service_param)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_details(text, text, text) TO anon;

-- Create RPC function for routine by task name
CREATE OR REPLACE FUNCTION get_routine_for_task_name(task_name_param text)
RETURNS TABLE (routine_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT routine_name
    FROM task_to_routine_map
    WHERE task_name = task_name_param
    AND deleted = false
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_routine_for_task_name(text) TO anon;

-- Create RPC function for signals consumed by task
CREATE OR REPLACE FUNCTION get_signals_consumed_by_task(task_name_param text)
RETURNS TABLE (signal_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_array_elements_text(signals->'observed') as signal_name
    FROM task
    WHERE name = task_name_param
    AND signals->'observed' IS NOT NULL
    AND NOT jsonb_array_elements_text(signals->'observed') LIKE 'meta.%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_signals_consumed_by_task(text) TO anon;

-- Create RPC function for signal emitters
CREATE OR REPLACE FUNCTION get_signal_emitters(signal_name_param text)
RETURNS TABLE (task_name text, service_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT name as task_name, service_name
    FROM task
    WHERE signals->'emits' ? signal_name_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_signal_emitters(text) TO anon;

-- Create RPC function for signals emitted by task
CREATE OR REPLACE FUNCTION get_signals_emitted_by_task(task_name_param text)
RETURNS TABLE (signal_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_array_elements_text(signals->'emits') as signal_name
    FROM task
    WHERE name = task_name_param
    AND signals->'emits' IS NOT NULL
    AND NOT jsonb_array_elements_text(signals->'emits') LIKE 'meta.%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_signals_emitted_by_task(text) TO anon;

-- Create RPC function for signal consumers
CREATE OR REPLACE FUNCTION get_signal_consumers(signal_name_param text)
RETURNS TABLE (task_name text, service_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT name as task_name, service_name
    FROM task
    WHERE signals->'observed' ? signal_name_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_signal_consumers(text) TO anon;

-- Create RPC function for task predecessors
CREATE OR REPLACE FUNCTION get_task_predecessors(task_name_param text, version_param text DEFAULT NULL, service_param text DEFAULT NULL)
RETURNS TABLE (predecessor_task_name text, predecessor_task_version text) AS $$
BEGIN
    RETURN QUERY
    SELECT predecessor_task_name, predecessor_task_version
    FROM directional_task_graph_map
    WHERE task_name = task_name_param
    AND (version_param IS NULL OR task_version = version_param)
    AND (service_param IS NULL OR service_name = service_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_predecessors(text, text, text) TO anon;

-- Create RPC function for task successors
CREATE OR REPLACE FUNCTION get_task_successors(task_name_param text, version_param text DEFAULT NULL, service_param text DEFAULT NULL)
RETURNS TABLE (task_name text, task_version text) AS $$
BEGIN
    RETURN QUERY
    SELECT task_name, task_version
    FROM directional_task_graph_map
    WHERE predecessor_task_name = task_name_param
    AND (version_param IS NULL OR predecessor_task_version = version_param)
    AND (service_param IS NULL OR service_name = service_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_task_successors(text, text, text) TO anon;

-- Create RPC function for static tasks in routine
CREATE OR REPLACE FUNCTION get_static_tasks_in_routine(routine_name_param text)
RETURNS TABLE (
    routine_name text,
    task_name text,
    name text,
    service_name text,
    version text,
    layer_index integer,
    description text,
    is_unique boolean,
    concurrency integer,
    signals jsonb,
    predecessor_task_name text,
    previous_task_execution_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ttrm.routine_name,
        ttrm.task_name,
        t.name,
        t.service_name,
        t.version,
        t.layer_index,
        t.description,
        t.is_unique,
        t.concurrency,
        t.signals,
        dtm.task_name,
        dtm.predecessor_task_name AS previous_task_execution_name
    FROM task_to_routine_map ttrm
    LEFT OUTER JOIN task t ON ttrm.task_name = t.name
    LEFT OUTER JOIN directional_task_graph_map dtm ON ttrm.task_name = dtm.task_name
    WHERE ttrm.routine_name = routine_name_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_static_tasks_in_routine(text) TO anon;

-- Create RPC function for external signal emitters
CREATE OR REPLACE FUNCTION get_external_signal_emitters(signal_names text[])
RETURNS TABLE (
    name text,
    service_name text,
    signals jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.name, t.service_name, t.signals
    FROM task t
    WHERE t.signals->'emits' ?| signal_names;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (for PostgREST)
GRANT EXECUTE ON FUNCTION get_external_signal_emitters(text[]) TO anon;
-- RPC functions for tasks in routines
CREATE OR REPLACE FUNCTION get_task_executions_for_routine(routine_execution_id_param UUID)
RETURNS TABLE (
    uuid UUID,
    routine_execution_id UUID,
    task_name TEXT,
    task_version TEXT,
    service_name TEXT,
    context JSONB,
    meta_context JSONB,
    result_context JSONB,
    meta_result_context JSONB,
    split_group_id UUID,
    service_instance_id UUID,
    execution_trace_id UUID,
    signal_emission_id UUID,
    is_scheduled BOOLEAN,
    is_running BOOLEAN,
    is_complete BOOLEAN,
    is_meta BOOLEAN,
    errored BOOLEAN,
    failed BOOLEAN,
    reached_timeout BOOLEAN,
    error_message TEXT,
    progress NUMERIC,
    created TIMESTAMPTZ,
    started TIMESTAMPTZ,
    ended TIMESTAMPTZ,
    deleted TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.uuid,
        te.routine_execution_id,
        te.task_name,
        te.task_version,
        te.service_name,
        te.context,
        te.meta_context,
        te.result_context,
        te.meta_result_context,
        te.split_group_id,
        te.service_instance_id,
        te.execution_trace_id,
        te.signal_emission_id,
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
        te.ended,
        te.deleted
    FROM task_execution te
    WHERE te.routine_execution_id = routine_execution_id_param
    ORDER BY te.created ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_task_execution_predecessors(task_execution_ids UUID[])
RETURNS TABLE (
    task_execution_id UUID,
    previous_task_execution_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tem.task_execution_id,
        tem.previous_task_execution_id
    FROM task_execution_map tem
    WHERE tem.task_execution_id = ANY(task_execution_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_signal_emissions_for_routine(routine_execution_id_param UUID)
RETURNS TABLE (
    uuid UUID,
    signal_name TEXT,
    signal_tag TEXT,
    task_name TEXT,
    task_version TEXT,
    task_execution_id UUID,
    service_name TEXT,
    service_instance_id UUID,
    execution_trace_id UUID,
    routine_execution_id UUID,
    data JSONB,
    metadata JSONB,
    is_meta BOOLEAN,
    is_metric BOOLEAN,
    emitted_at TIMESTAMPTZ,
    created TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        se.uuid,
        se.signal_name,
        se.signal_tag,
        se.task_name,
        se.task_version,
        se.task_execution_id,
        se.service_name,
        se.service_instance_id,
        se.execution_trace_id,
        se.routine_execution_id,
        se.data,
        se.metadata,
        se.is_meta,
        se.is_metric,
        se.emitted_at,
        se.created
    FROM signal_emission se
    WHERE se.routine_execution_id = routine_execution_id_param
    ORDER BY se.emitted_at ASC NULLS LAST, se.created ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_task_executions_for_routine(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_task_execution_predecessors(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_signal_emissions_for_routine(UUID) TO authenticated;

