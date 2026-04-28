import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { CustomerHealth, CustomerTag, Territory } from '$lib/types/db';

export const load: LayoutServerLoad = async ({ params, locals: { supabase } }) => {
  const [clientRes, healthRes, territoryRes, tagsRes] = await Promise.all([
    supabase.from('customers').select('*').eq('id', params.id).maybeSingle(),
    supabase
      .from('customer_health')
      .select('*')
      .eq('customer_id', params.id)
      .maybeSingle(),
    supabase.from('territories').select('id, name').order('name'),
    supabase
      .from('customer_tag_assignments')
      .select('tag:customer_tags(id, name, color)')
      .eq('customer_id', params.id)
  ]);

  if (clientRes.error || !clientRes.data) throw error(404, 'Client not found');

  const tags = (tagsRes.data ?? [])
    .map((row: unknown) => (row as { tag: CustomerTag | null }).tag)
    .filter((t): t is CustomerTag => !!t);

  return {
    client: clientRes.data,
    health: (healthRes.data ?? null) as CustomerHealth | null,
    territories: (territoryRes.data ?? []) as Pick<Territory, 'id' | 'name'>[],
    tags
  };
};
