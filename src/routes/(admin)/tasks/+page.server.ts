import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  ACTIONABLE_TASK_STATUSES,
  ALL_TASK_STATUSES,
  type CustomerTask,
  type TaskPriority,
  type TaskStatus
} from '$lib/types/db';

const STATUSES = ALL_TASK_STATUSES;
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

// Board shows all matching tasks at once; cap to keep the page bounded.
const TASK_LIMIT = 300;

export const load: PageServerLoad = async ({ url, locals: { supabase, user } }) => {
  const view = url.searchParams.get('view') ?? 'mine';
  const priorityParam = url.searchParams.get('priority') ?? '';
  const assignee = url.searchParams.get('assignee') ?? '';
  const customer = url.searchParams.get('customer') ?? '';

  let q = supabase
    .from('customer_tasks')
    .select(
      'id, customer_id, assigned_to, title, description, status, priority, due_at, created_at,' +
        ' customer:customers(business_name),' +
        ' assignee:user_profiles!customer_tasks_assigned_to_fkey(display_name)',
      { count: 'exact' }
    )
    // Sort so each column lands with urgent/soon-due at the top.
    .order('priority', { ascending: false })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(TASK_LIMIT);

  if (view === 'mine') {
    if (user?.id) q = q.eq('assigned_to', user.id);
  } else if (view === 'overdue') {
    q = q
      .in('status', ACTIONABLE_TASK_STATUSES as unknown as string[])
      .lt('due_at', new Date().toISOString());
  } else if (view === 'unassigned') {
    q = q.is('assigned_to', null);
  }

  if (priorityParam && PRIORITIES.includes(priorityParam as TaskPriority)) {
    q = q.eq('priority', priorityParam);
  }
  if (assignee) q = q.eq('assigned_to', assignee);
  if (customer) q = q.eq('customer_id', customer);

  const [tasksRes, adminsRes, customersRes] = await Promise.all([
    q,
    supabase
      .from('user_profiles')
      .select('id, display_name')
      .eq('role', 'admin')
      .order('display_name'),
    supabase.from('customers').select('id, business_name').order('business_name')
  ]);

  return {
    tasks: (tasksRes.data ?? []) as unknown as (Pick<
      CustomerTask,
      | 'id'
      | 'customer_id'
      | 'assigned_to'
      | 'title'
      | 'description'
      | 'status'
      | 'priority'
      | 'due_at'
      | 'created_at'
    > & {
      customer: { business_name: string } | null;
      assignee: { display_name: string | null } | null;
    })[],
    total: tasksRes.count ?? 0,
    limit: TASK_LIMIT,
    admins: adminsRes.data ?? [],
    customers: customersRes.data ?? [],
    filters: { view, priority: priorityParam, assignee, customer }
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
  },

  setDue: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const raw = String(form.get('due_at') ?? '').trim();
    const due_at = raw ? new Date(raw).toISOString() : null;
    const { error } = await supabase.from('customer_tasks').update({ due_at }).eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setPriority: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const priority = String(form.get('priority') ?? '');
    if (!PRIORITIES.includes(priority as TaskPriority)) {
      return fail(400, { message: 'Invalid priority.' });
    }
    const { error } = await supabase.from('customer_tasks').update({ priority }).eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setAssignee: async ({ request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const raw = String(form.get('assigned_to') ?? '').trim();
    const assigned_to = raw || null;
    const { error } = await supabase.from('customer_tasks').update({ assigned_to }).eq('id', id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  create: async ({ request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    if (!title) return fail(400, { message: 'Title is required.' });
    const customer_id = String(form.get('customer_id') ?? '').trim();
    if (!customer_id) return fail(400, { message: 'Customer is required.' });
    const priority = String(form.get('priority') ?? 'normal');
    if (!PRIORITIES.includes(priority as TaskPriority)) {
      return fail(400, { message: 'Invalid priority.' });
    }
    const assigned_to = String(form.get('assigned_to') ?? '').trim() || null;
    const due = String(form.get('due_at') ?? '').trim();
    // Default to 'assigned' if an owner was picked, else 'unassigned' (matches DB default).
    const status: TaskStatus = assigned_to ? 'assigned' : 'unassigned';
    const { error } = await supabase.from('customer_tasks').insert({
      customer_id,
      created_by: user?.id ?? null,
      assigned_to,
      title,
      description: String(form.get('description') ?? '').trim() || null,
      priority,
      status,
      due_at: due ? new Date(due).toISOString() : null
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};
