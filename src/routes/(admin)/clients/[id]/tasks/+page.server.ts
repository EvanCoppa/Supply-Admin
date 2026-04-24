import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { CustomerTask, TaskPriority, TaskStatus } from '$lib/types/db';

const STATUSES: TaskStatus[] = ['open', 'in_progress', 'done', 'cancelled'];
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const [tasksRes, adminsRes] = await Promise.all([
    supabase
      .from('customer_tasks')
      .select(
        'id, customer_id, assigned_to, created_by, title, description, due_at, status, priority,' +
          ' related_activity_id, related_order_id, completed_at, created_at, updated_at,' +
          ' assignee:user_profiles!customer_tasks_assigned_to_fkey(display_name)'
      )
      .eq('customer_id', params.id)
      .order('status', { ascending: true })
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('id, display_name')
      .eq('role', 'admin')
      .order('display_name')
  ]);

  return {
    tasks: (tasksRes.data ?? []) as unknown as Array<
      CustomerTask & { assignee: { display_name: string | null } | null }
    >,
    admins: (adminsRes.data ?? []) as Array<{ id: string; display_name: string | null }>
  };
};

export const actions: Actions = {
  create: async ({ params, request, locals: { supabase, user } }) => {
    const form = await request.formData();
    const title = String(form.get('title') ?? '').trim();
    if (!title) return fail(400, { message: 'Title is required.' });
    const priority = String(form.get('priority') ?? 'normal');
    if (!PRIORITIES.includes(priority as TaskPriority)) {
      return fail(400, { message: 'Invalid priority.' });
    }
    const due = String(form.get('due_at') ?? '').trim();
    const { error } = await supabase.from('customer_tasks').insert({
      customer_id: params.id,
      created_by: user?.id ?? null,
      assigned_to: String(form.get('assigned_to') ?? '').trim() || null,
      title,
      description: String(form.get('description') ?? '').trim() || null,
      priority,
      due_at: due ? new Date(due).toISOString() : null
    });
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  setStatus: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const status = String(form.get('status') ?? '');
    if (!STATUSES.includes(status as TaskStatus)) {
      return fail(400, { message: 'Invalid status.' });
    }
    const { error } = await supabase
      .from('customer_tasks')
      .update({ status })
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  },

  delete: async ({ params, request, locals: { supabase } }) => {
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const { error } = await supabase
      .from('customer_tasks')
      .delete()
      .eq('id', id)
      .eq('customer_id', params.id);
    if (error) return fail(400, { message: error.message });
    return { saved: true };
  }
};
