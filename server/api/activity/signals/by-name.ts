import { supabaseAdmin } from '~/utils/supabase';

async function getLatestEmissionByName(signalName: string) {
  const { data, error } = await supabaseAdmin
    .from('signal_emission')
    .select('*')
    .eq('signal_name', signalName)
    .order('emitted_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

export default defineEventHandler(async (event) => {
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
