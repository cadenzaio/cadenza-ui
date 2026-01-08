import { initializeClient } from '~/server/api/utils';
import { Client } from 'pg';
import { getQuery } from 'h3';

let client: Client | null = null;

async function getClient() {
  if (!client) {
    client = await initializeClient();
  }
  return client;
}

async function getTaskCount(serviceInstanceId?: string) {
  let query = `
    SELECT
      DATE_TRUNC('hour', started) as started,
      COUNT(*) as count
    FROM task_execution
    WHERE is_meta = false
  `;
  const params: string[] = [];
  if (serviceInstanceId) {
    params.push(serviceInstanceId);
    query += ` AND service_instance_id = $${params.length}`;
  }
  query += ` GROUP BY DATE_TRUNC('hour', started) ORDER BY DATE_TRUNC('hour', started)`;

  const client = await getClient();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

async function getSignalCount(serviceInstanceId?: string) {
  const params: string[] = [];
  params.push(serviceInstanceId ?? '');

  const query = `
    SELECT started, COUNT(*) as count FROM (
      SELECT uuid, DATE_TRUNC('hour', emitted_at) as started
      FROM signal_emission se
      WHERE is_meta = false AND se.service_instance_id = $1
    ) t
    GROUP BY started
    ORDER BY started
  `;

  const client = await getClient();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error executing signal count query:', error);
    throw error;
  }
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await getClient();
  }

  const { method } = event.node.req;
  const q = getQuery(event);
  const serviceInstanceId = (q.serviceInstanceId as string) || (q.serviceInstance as string) || undefined;

  if (method === 'GET') {
    if (!serviceInstanceId) {
      return { error: 'Missing required query parameter: serviceInstanceId' };
    }

    try {
      const [taskRows, signalRows] = await Promise.all([
        getTaskCount(serviceInstanceId),
        getSignalCount(serviceInstanceId),
      ]);

      const series: any[] = [];

      if (taskRows && taskRows.length > 0) {
        const taskSeriesData = taskRows.map((r: any) => [new Date(r.started).getTime(), Number(r.count) || 0]);
        series.push({ name: 'Task Count', data: taskSeriesData });
      }

      if (signalRows && signalRows.length > 0) {
        const signalSeriesData = signalRows.map((r: any) => [new Date(r.started).getTime(), Number(r.count) || 0]);
        series.push({ name: 'Signal Count', data: signalSeriesData });
      }

      const tsSet = new Set<number>();
      for (const s of series) {
        if (Array.isArray(s.data)) {
          for (const d of s.data) {
            if (Array.isArray(d) && typeof d[0] === 'number') tsSet.add(d[0]);
          }
        }
      }

      let timestamps = Array.from(tsSet).sort((a, b) => a - b);
      if (timestamps.length === 0) {
        const now = Date.now();
        const hour = 60 * 60 * 1000;
        const base = now - (now % hour);
        for (let i = 5; i >= 0; i--) timestamps.push(base - i * hour);
      }

      const rand = (min: number, max: number) => Math.random() * (max - min) + min;
      const MAX_RAM_MB = 64 * 1024;

      const cpuSeries = { name: 'CPU (%)', data: timestamps.map((t) => [t, Math.min(100, Math.round(rand(5, 65)) )]) };
      const diskSeries = { name: 'Disk (%)', data: timestamps.map((t) => [t, Math.min(100, Math.round(rand(10, 92)) )]) };
      const networkSeries = { name: 'Network (%)', data: timestamps.map((t) => [t, Math.min(100, Math.round(rand(0.5, 50)))]) };
      const ramSeries = { name: 'RAM (%)', data: timestamps.map((t) => [t, Math.min(100, Math.round(rand(2048, MAX_RAM_MB) / MAX_RAM_MB * 100))]) };

      series.push(cpuSeries, diskSeries, networkSeries, ramSeries);

      return { series };
    } catch (error) {
      console.error('Error fetching server stats:', error);
      throw error;
    }
  }

  return { error: 'Invalid request' };
});