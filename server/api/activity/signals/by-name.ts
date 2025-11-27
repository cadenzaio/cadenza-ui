import pg from 'pg';
import { initializeClient } from '~/server/api/utils';

let client: pg.Client | null = null;

async function getLatestEmissionByName(signalName: string) {
  const query = `
    SELECT *
    FROM signal_emission
    WHERE signal_name = $1
    ORDER BY emitted_at DESC
    LIMIT 1
  `;
  const res = await client!.query(query, [signalName]);
  return res.rows[0] || null;
}

export default defineEventHandler(async (event) => {
  if (!client) {
    client = await initializeClient();
  }

  const { method } = event.node.req;
  if (method !== 'GET') {
    return { error: 'Method not allowed' };
  }

  const name = getQuery(event).name as string | undefined;
  if (!name) {
    return { error: 'Missing required query parameter `name`' };
  }

  try {
    const emission = await getLatestEmissionByName(name);
    if (!emission) {
      return { error: 'No emission found for signal', name };
    }
    return { emission };
  } catch (err) {
    console.error('Error fetching emission by name:', err);
    return { error: 'Internal server error' };
  }
});
