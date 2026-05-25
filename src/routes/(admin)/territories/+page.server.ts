import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Territory } from '$lib/types/db';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data: terr } = await supabase
    .from('territories')
    .select('id, name, description, created_at')
    .order('name');

  const territories = (terr ?? []) as Territory[];

  const counts = await supabase.from('customers').select('territory_id');
  const countByTerritory = new Map<string, number>();
  for (const row of counts.data ?? []) {
    if (row.territory_id) {
      countByTerritory.set(row.territory_id, (countByTerritory.get(row.territory_id) ?? 0) + 1);
    }
  }

  const { data: reps } = await supabase
    .from('territory_reps')
    .select('territory_id, user_id, user_profiles(id, display_name)');

  const repsByTerritory = new Map<string, { id: string; display_name: string | null }[]>();
  for (const rep of reps ?? []) {
    const raw = rep.user_profiles as unknown as
      | { id: string; display_name: string | null }
      | { id: string; display_name: string | null }[]
      | null;
    const profile = Array.isArray(raw) ? raw[0] : raw;
    if (!profile) continue;
    const list = repsByTerritory.get(rep.territory_id) ?? [];
    list.push({ id: profile.id, display_name: profile.display_name });
    repsByTerritory.set(rep.territory_id, list);
  }

  const { data: adminUsers } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .eq('role', 'admin')
    .order('display_name');

  return {
    territories: territories.map((t) => ({
      ...t,
      customer_count: countByTerritory.get(t.id) ?? 0,
      reps: repsByTerritory.get(t.id) ?? []
    })),
    adminUsers: adminUsers ?? []
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
  },

  addRep: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const territory_id = String(form.get('territory_id') ?? '');
    const user_id = String(form.get('user_id') ?? '');
    if (!territory_id || !user_id)
      return fail(400, { message: 'Territory and user are required.' });
    const { error } = await supabase.from('territory_reps').insert({
      territory_id,
      user_id
    });
    if (error) {
      if (error.code === '23505') {
        return fail(400, { message: 'This user is already assigned to this territory.' });
      }
      return fail(400, { message: error.message });
    }
    return { saved: true };
  },

  removeRep: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return fail(400, { message: 'Rep ID is required.' });
    const { error } = await supabase.from('territory_reps').delete().eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};
