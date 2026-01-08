import pg from 'pg';
import { initializeClient, formatDateLocale } from '~/server/api/utils';
import { createError, getQuery } from 'h3';

let client: pg.Client | null = null;

async function getInstanceLog(
    serviceInstanceId: string,
    page: number = 1,
    limit: number = 100,
    level?: string
) {
    const offset = (page - 1) * limit;
    let query = `
        SELECT
            uuid,
            message,
            level,
            service_name,
            service_instance_id,
            subject_service_name,
            subject_service_instance_id,
            data,
            created
        FROM system_log
        WHERE service_instance_id = $1`;
    const values: (string | number)[] = [serviceInstanceId];
    if (level) {
        query += ' AND level = $2';
        values.push(level);
        query += ' ORDER BY created DESC LIMIT $3 OFFSET $4';
        values.push(limit, offset);
    } else {
        query += ' ORDER BY created DESC LIMIT $2 OFFSET $3';
        values.push(limit, offset);
    }
    const result = await client!.query(query, values);
    return {
        logs: result.rows.map((row) => ({
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
    if (!client) {
        client = await initializeClient();
    }

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