import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerTask, TaskStatus } from '$lib/types/db';

const STATUSES: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];
const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url, locals: { supabase, user } }) => {
  const view = url.searchParams.get('view') ?? 'mine_open';
  const statusParam = url.searchParams.get('status') ?? '';
  const assignee = url.searchParams.get('assignee') ?? '';
  const customer = url.searchParams.get('customer') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from('customer_tasks')
    .select(
      'id, customer_id, assigned_to, title, status, priority, due_at, created_at,' +
        ' customer:customers(business_name),' +
        ' assignee:user_profiles!customer_tasks_assigned_to_fkey(display_name)',
      { count: 'exact' }
    )
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (view === 'mine_open') {
    if (user?.id) q = q.eq('assigned_to', user.id);
    q = q.in('status', ['open', 'in_progress']);
  } else if (view === 'overdue') {
    q = q.in('status', ['open', 'in_progress']).lt('due_at', new Date().toISOString());
  } else if (view === 'unassigned') {
    q = q.is('assigned_to', null).in('status', ['open', 'in_progress']);
  }

  if (statusParam && STATUSES.includes(statusParam as TaskStatus)) {
    q = q.eq('status', statusParam);
  }
  if (assignee) q = q.eq('assigned_to', assignee);
  if (customer) q = q.eq('customer_id', customer);

  const [tasksRes, adminsRes] = await Promise.all([
    q,
    supabase
      .from('user_profiles')
      .select('id, display_name')
      .eq('role', 'admin')
      .order('display_name')
  ]);

  return {
    tasks: (tasksRes.data ?? []) as unknown as Array<
      Pick<
        CustomerTask,
        'id' | 'customer_id' | 'assigned_to' | 'title' | 'status' | 'priority' | 'due_at' | 'created_at'
      > & {
        customer: { business_name: string } | null;
        assignee: { display_name: string | null } | null;
      }
    >,
    total: tasksRes.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    admins: (adminsRes.data ?? []) as Array<{ id: string; display_name: string | null }>,
    filters: { view, status: statusParam, assignee, customer }
  };
};

export const actions: Actions = {
  setStatus: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const status = String(form.get('status') ?? '');
    if (!STATUSES.includes(status as TaskStatus)) {
      return fail(400, { message: 'Invalid status.' });
    }
    const { error } = await supabase.from('customer_tasks').update({ status }).eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};
