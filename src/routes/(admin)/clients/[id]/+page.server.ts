import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerLifecycleStage, CustomerStatus, CustomerTag, Territory } from '$lib/types/db';

const LIFECYCLE_STAGES: CustomerLifecycleStage[] = [
  'lead',
  'prospect',
  'active',
  'at_risk',
  'churned'
];
const STATUSES: CustomerStatus[] = ['active', 'suspended', 'archived'];

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
    const status = String(form.get('status') ?? 'active');
    const lifecycle_stage = String(form.get('lifecycle_stage') ?? 'active');

    if (!STATUSES.includes(status as CustomerStatus)) {
      return fail(400, { message: 'Invalid status.' });
    }
    if (!LIFECYCLE_STAGES.includes(lifecycle_stage as CustomerLifecycleStage)) {
      return fail(400, { message: 'Invalid lifecycle stage.' });
    }

    const payload = {
      business_name: String(form.get('business_name') ?? '').trim(),
      primary_contact_name: String(form.get('primary_contact_name') ?? '').trim() || null,
      email: String(form.get('email') ?? '').trim() || null,
      phone: String(form.get('phone') ?? '').trim() || null,
      assigned_sales_rep_id: String(form.get('assigned_sales_rep_id') ?? '').trim() || null,
      territory_id: String(form.get('territory_id') ?? '').trim() || null,
      status,
      lifecycle_stage
    };
    if (!payload.business_name) return fail(400, { message: 'Business name is required.' });

    const { error } = await supabase.from('customers').update(payload).eq('id', params.id);
    if (error) return fail(400, { message: error.message });

    const tagIds = form.getAll('tag_id').map((v) => String(v)).filter(Boolean);
    const delRes = await supabase
      .from('customer_tag_assignments')
      .delete()
      .eq('customer_id', params.id);
    if (delRes.error) return fail(400, { message: delRes.error.message });

    if (tagIds.length) {
      const insRes = await supabase
        .from('customer_tag_assignments')
        .insert(tagIds.map((tag_id) => ({ customer_id: params.id, tag_id })));
      if (insRes.error) return fail(400, { message: insRes.error.message });
    }

    return { saved: true };
  }
};
