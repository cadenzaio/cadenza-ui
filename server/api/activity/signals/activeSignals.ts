import { supabaseAdmin } from '~/utils/supabase';

async function getAllSignalEmissions() {
  const { data, error } = await supabaseAdmin
    .from('signal_emission')
    .select(`
      uuid,
      signal_name,
      emitted_at,
      created,
      service_name,
      service_instance_id
    `)
    .eq('is_meta', false);

  if (error) {
    console.error('Error fetching signal emissions:', error.message, error);
    throw new Error(`Failed to fetch signal emissions: ${error.message}`);
  }

  return data;
}

export default getAllSignalEmissions;