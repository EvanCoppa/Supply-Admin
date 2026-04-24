import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerLifecycleStage, CustomerTag, Territory } from '$lib/types/db';

const PAGE_SIZE = 25;
const LIFECYCLE_STAGES: CustomerLifecycleStage[] = [
  'lead',
  'prospect',
  'active',
  'at_risk',
  'churned'
];

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
  const search = url.searchParams.get('q')?.trim() ?? '';
  const status = url.searchParams.get('status') ?? '';
  const lifecycle = url.searchParams.get('lifecycle') ?? '';
  const territory = url.searchParams.get('territory') ?? '';
  const tag = url.searchParams.get('tag') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let tagCustomerIds: string[] | null = null;
  if (tag) {
    const tagRes = await supabase
      .from('customer_tag_assignments')
      .select('customer_id')
      .eq('tag_id', tag);
    tagCustomerIds = (tagRes.data ?? []).map((r) => r.customer_id);
    if (tagCustomerIds.length === 0) {
      return {
        clients: [],
        total: 0,
        page,
        pageSize: PAGE_SIZE,
        filters: { search, status, lifecycle, territory, tag },
        territories: [] as Pick<Territory, 'id' | 'name'>[],
        tagOptions: [] as CustomerTag[]
      };
    }
  }

  let query = supabase
    .from('customers')
    .select(
      'id, business_name, primary_contact_name, email, status, lifecycle_stage, territory_id, created_at,' +
        ' sales_rep:user_profiles!customers_assigned_sales_rep_fk(display_name),' +
        ' territory:territories(name),' +
        ' tag_assignments:customer_tag_assignments(tag:customer_tags(id, name, color))',
      { count: 'exact' }
    )
    .order('business_name', { ascending: true })
    .range(from, to);

  if (search) {
    query = query.or(`business_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (['active', 'suspended', 'archived'].includes(status)) {
    query = query.eq('status', status);
  }
  if (LIFECYCLE_STAGES.includes(lifecycle as CustomerLifecycleStage)) {
    query = query.eq('lifecycle_stage', lifecycle);
  }
  if (territory) query = query.eq('territory_id', territory);
  if (tagCustomerIds) query = query.in('id', tagCustomerIds);

  const [res, territoriesRes, tagsRes] = await Promise.all([
    query,
    supabase.from('territories').select('id, name').order('name'),
    supabase.from('customer_tags').select('id, name, color').order('name')
  ]);

  type ClientRow = {
    id: string;
    business_name: string;
    primary_contact_name: string | null;
    email: string | null;
    status: 'active' | 'suspended' | 'archived';
    lifecycle_stage: CustomerLifecycleStage;
    territory_id: string | null;
    created_at: string;
    sales_rep: { display_name: string | null } | null;
    territory: { name: string } | null;
    tag_assignments: Array<{ tag: Pick<CustomerTag, 'id' | 'name' | 'color'> | null }>;
  };

  return {
    clients: (res.data ?? []) as unknown as ClientRow[],
    total: res.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    filters: { search, status, lifecycle, territory, tag },
    territories: (territoriesRes.data ?? []) as Pick<Territory, 'id' | 'name'>[],
    tagOptions: (tagsRes.data ?? []) as CustomerTag[]
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const business_name = String(form.get('business_name') ?? '').trim();
    if (!business_name) return fail(400, { message: 'Business name is required.' });

    const { data, error } = await supabase
      .from('customers')
      .insert({
        business_name,
        primary_contact_name: String(form.get('primary_contact_name') ?? '').trim() || null,
        email: String(form.get('email') ?? '').trim() || null,
        phone: String(form.get('phone') ?? '').trim() || null
      })
      .select('id')
      .single();

    if (error) return fail(400, { message: error.message });
    throw redirect(303, `/clients/${data.id}`);
  }
};
