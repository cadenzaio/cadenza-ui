import pg from 'pg';
import { initializeClient, formatDateLocale } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getAllServersWithStats(
  processingGraph?: string,
  page: number = 1,
  limit: number = 100
) {
  const offset = (page - 1) * limit;
  let query = `
    SELECT
        s.uuid,
        s.address,
        s.port,
        s.process_pid,
        s.is_primary,
        s.is_active,
        s.is_non_responsive,
        s.is_blocked,
        s.processing_graph,
        s.modified
    FROM server s
    WHERE s.is_active = true
  `;
  const values: (string | number)[] = [];

  if (processingGraph) {
    query += ` AND s.processing_graph = $1`;
    values.push(processingGraph);
  }

  query += ` ORDER by s.modified DESC LIMIT $${values.length + 1} OFFSET $${
    values.length + 2
  }`;
  values.push(limit, offset);

  const result = await client!.query(query, values);
  return {
    servers: result.rows.map((row) => ({
      uuid: row.uuid,
      graph: row.processing_graph,
      address: row.address,
      port: row.port,
      processPid: row.process_pid,
      status: row.is_active ? 'check' : 'schedule',
      isPrimary: row.is_primary,
      modified: formatDateLocale(row.modified),
      displayStatus: row.is_active ? 'Active' : 'Inactive',
    })),
  };
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;

  if (method === 'GET') {
    try {
      const query = getQuery(event);
      const processingGraph = query.processingGraph as string | undefined;
      const page = parseInt(query.page as string) || 1;
      const limit = parseInt(query.limit as string) || 100;
      return await getAllServersWithStats(processingGraph, page, limit);
    } catch (error) {
      console.error('Error fetching server stats:', error);
      throw error;
    }
  }
});
