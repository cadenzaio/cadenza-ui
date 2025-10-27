import { initializeClient } from '~/server/api/utils';
import pg from 'pg';

let client: pg.Client | null = null;

/**
 * Fetch all records from the signal_emission table where is_meta is false.
 */
async function getAllSignalEmissions() {
  if (!client) {
    client = await initializeClient();
  }

  const query = `
    SELECT 
        se.uuid,
        se.signal_name AS name,
        se.emitted_at,
        se.created,
        se.service_name AS service,
        se.service_instance_id AS service_instance_id
    FROM signal_emission se
    WHERE is_meta = true;
  `;

  try {
    const result = await client.query(query);
    return result.rows;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error fetching signal emissions:', error.message, error.stack);
      throw new Error(`Failed to fetch signal emissions: ${error.message}`);
    } else {
      console.error('Unknown error fetching signal emissions:', error);
      throw new Error('Failed to fetch signal emissions due to an unknown error');
    }
  }
}

export default getAllSignalEmissions;