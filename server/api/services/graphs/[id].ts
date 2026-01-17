import { supabaseAdmin } from '~/utils/supabase';
import { formatDateLocale } from '~/server/api/utils';

async function getGraph(serviceInstanceId: string) {
  const { data, error } = await supabaseAdmin
    .from('service')
    .select('*')
    .eq('name', serviceInstanceId)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return {
    name: data.name,
    description: data.description,
    modified: formatDateLocale(data.modified),
    deleted: data.deleted,
    created: formatDateLocale(data.created),
    deletedStatus: data.deleted ? 'Yes' : 'No',
    displayName: data.display_name || data.name,
  };
}

export default defineEventHandler(async (event) => {
  const { method } = event.node.req;
  const serviceInstanceId = decodeURIComponent(event.context.params?.id ?? '');

  if (method === 'GET') {
    try {
      return await getGraph(serviceInstanceId);
    } catch (error) {
      console.error('Error fetching graph:', error);
      throw error;
    }
  }
});
