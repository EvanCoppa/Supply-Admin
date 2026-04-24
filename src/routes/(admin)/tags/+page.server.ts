import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerTag } from '$lib/types/db';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const [tagsRes, assignmentsRes] = await Promise.all([
    supabase.from('customer_tags').select('id, name, color, created_at').order('name'),
    supabase.from('customer_tag_assignments').select('tag_id')
  ]);

  const counts = new Map<string, number>();
  for (const row of assignmentsRes.data ?? []) {
    counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
  }
  const tags = (tagsRes.data ?? []) as CustomerTag[];
  return {
    tags: tags.map((t) => ({ ...t, customer_count: counts.get(t.id) ?? 0 }))
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    if (!name) return fail(400, { message: 'Name is required.' });
    const color = String(form.get('color') ?? '').trim() || null;
    const { error } = await supabase.from('customer_tags').insert({ name, color });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  update: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const name = String(form.get('name') ?? '').trim();
    if (!id || !name) return fail(400, { message: 'Name is required.' });
    const { error } = await supabase
      .from('customer_tags')
      .update({ name, color: String(form.get('color') ?? '').trim() || null })
      .eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase.from('customer_tags').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};
