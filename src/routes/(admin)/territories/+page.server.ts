import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Territory } from '$lib/types/db';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data } = await supabase
    .from('territories')
    .select('id, name, description, created_at')
    .order('name');

  const terr = (data ?? []) as Territory[];

  const counts = await supabase.from('customers').select('territory_id');
  const countByTerritory = new Map<string, number>();
  for (const row of counts.data ?? []) {
    if (row.territory_id) {
      countByTerritory.set(row.territory_id, (countByTerritory.get(row.territory_id) ?? 0) + 1);
    }
  }

  return {
    territories: terr.map((t) => ({
      ...t,
      customer_count: countByTerritory.get(t.id) ?? 0
    }))
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    if (!name) return fail(400, { message: 'Name is required.' });
    const { error } = await supabase.from('territories').insert({
      name,
      description: String(form.get('description') ?? '').trim() || null
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  update: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const name = String(form.get('name') ?? '').trim();
    if (!id || !name) return fail(400, { message: 'Name is required.' });
    const { error } = await supabase
      .from('territories')
      .update({
        name,
        description: String(form.get('description') ?? '').trim() || null
      })
      .eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('territories').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};
