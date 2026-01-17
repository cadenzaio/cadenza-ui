import { supabaseAdmin } from '~/utils/supabase';
import { formatDateLocale } from '~/server/api/utils';
import { createError, getQuery } from 'h3';

async function getInstanceLog(
    serviceInstanceId: string,
    page: number = 1,
    limit: number = 100,
    level?: string
) {
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from('system_log')
        .select(`
            uuid,
            message,
            level,
            service_name,
            service_instance_id,
            subject_service_name,
            subject_service_instance_id,
            data,
            created
        `)
        .eq('service_instance_id', serviceInstanceId)
        .order('created', { ascending: false })
        .range(offset, offset + limit - 1);

    if (level) {
        query = query.eq('level', level);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return {
        logs: data.map((row) => ({
            uuid: row.uuid,
            message: row.message,
            level: row.level,
            serviceName: row.service_name,
            serviceInstanceId: row.service_instance_id,
            subjectServiceName: row.subject_service_name,
            subjectServiceInstanceId: row.subject_service_instance_id,
            data: row.data,
            created: formatDateLocale(row.created),
        })),
    };
}

export default defineEventHandler(async (event) => {
    if (event.node.req.method === 'GET') {
        const q = getQuery(event);
        const serviceInstanceId = q.serviceInstanceId as string | undefined;
        const page = parseInt((q.page as string) || '1', 10) || 1;
        const limit = parseInt((q.limit as string) || '100', 10) || 100;
        const level = q.level as string | undefined;

        if (!serviceInstanceId) {
            throw createError({ statusCode: 400, statusMessage: 'Missing serviceInstanceId' });
        }

        try {
            return await getInstanceLog(serviceInstanceId, page, limit, level);
        } catch (error: any) {
            console.error('Error fetching instance log:', error);
            throw error;
        }
    }
});