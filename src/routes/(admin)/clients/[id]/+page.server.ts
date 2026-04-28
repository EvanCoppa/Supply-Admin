import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerTag, Territory } from '$lib/types/db';
import { customerUpdateSchema, parseForm } from '$lib/schemas';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [adminsRes, territoriesRes, tagsRes, assignedTagsRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, display_name')
      .eq('role', 'admin')
      .order('display_name'),
    supabase.from('territories').select('id, name').order('name'),
    supabase.from('customer_tags').select('id, name, color').order('name'),
    supabase
      .from('customer_tag_assignments')
      .select('tag_id')
      .eq('customer_id', params.id)
  ]);

  const assignedTagIds = new Set((assignedTagsRes.data ?? []).map((r) => r.tag_id));

  return {
    admins: (adminsRes.data ?? []) as Array<{ id: string; display_name: string | null }>,
    territories: (territoriesRes.data ?? []) as Pick<Territory, 'id' | 'name'>[],
    tagOptions: (tagsRes.data ?? []) as CustomerTag[],
    assignedTagIds: [...assignedTagIds]
  };
};

export const actions: Actions = {
  save: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const parsed = parseForm(customerUpdateSchema, form);
    if (!parsed.success) {
      return fail(400, { message: parsed.message, fieldErrors: parsed.fieldErrors });
    }

    const { tag_id: tagIds, ...payload } = parsed.data;

    const { error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', params.id);
    if (error) return fail(400, { message: error.message, fieldErrors: {} });

    const delRes = await supabase
      .from('customer_tag_assignments')
      .delete()
      .eq('customer_id', params.id);
    if (delRes.error) return fail(400, { message: delRes.error.message, fieldErrors: {} });

    if (tagIds.length) {
      const insRes = await supabase
        .from('customer_tag_assignments')
        .insert(tagIds.map((tag_id) => ({ customer_id: params.id, tag_id })));
      if (insRes.error) return fail(400, { message: insRes.error.message, fieldErrors: {} });
    }

    return { saved: true };
  }
};
