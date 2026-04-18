"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { currentUserId } from "@/lib/visibility";

export async function fetchTaskById(taskId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const rows = await sql`
    SELECT t.*,
           c.id as contact_id_ref, c.first_name as contact_first_name,
           c.last_name as contact_last_name, c.company as contact_company
    FROM tasks t
    LEFT JOIN contacts c ON c.id = t.contact_id AND (c.is_private = false OR c.created_by = ${userId})
    WHERE t.id = ${taskId} AND ${vis}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    contact_id: r.contact_id,
    parent_task_id: r.parent_task_id,
    template_id: r.template_id,
    priority: r.priority,
    status: r.status,
    start_date: r.start_date,
    due_date: r.due_date,
    is_milestone: r.is_milestone,
    is_private: r.is_private,
    task_type_id: r.task_type_id,
    is_recurring: r.is_recurring,
    recurrence_frequency: r.recurrence_frequency,
    recurrence_unit: r.recurrence_unit,
    recurrence_source_task_id: r.recurrence_source_task_id,
    created_at: r.created_at,
    contacts: r.contact_id_ref
      ? { id: r.contact_id_ref, first_name: r.contact_first_name, last_name: r.contact_last_name, company: r.contact_company }
      : null,
    task_assignees: [] as { employee_id: string; employees: { id: string; first_name: string; last_name: string } }[],
  };
}

export async function fetchTaskAssigneesForTask(taskId: string) {
  const userId = await currentUserId();
  const rows = await sql`
    SELECT ta.employee_id, e.id as emp_id, e.first_name, e.last_name
    FROM task_assignees ta
    JOIN employees e ON e.id = ta.employee_id AND (e.is_private = false OR e.created_by = ${userId})
    WHERE ta.task_id = ${taskId}
  `;
  return rows.map((r) => ({
    employee_id: r.employee_id,
    employees: { id: r.emp_id, first_name: r.first_name, last_name: r.last_name },
  }));
}

export async function fetchDependencies(taskId: string) {
  const deps = await sql`
    SELECT id, dependency_type, lag_days, depends_on_task_id
    FROM task_dependencies
    WHERE task_id = ${taskId}
  `;
  if (deps.length === 0) return [];

  const depTaskIds = deps.map((d) => d.depends_on_task_id);
  const taskData = await sql`
    SELECT id, title FROM tasks WHERE id = ANY(${depTaskIds})
  `;
  const titleMap: Record<string, string> = {};
  for (const t of taskData) titleMap[t.id] = t.title;

  return deps.map((d) => ({
    id: d.id,
    dependency_type: d.dependency_type,
    lag_days: d.lag_days,
    depends_on_task_id: d.depends_on_task_id,
    depends_on_task_title: titleMap[d.depends_on_task_id] || undefined,
  }));
}

export async function fetchAllTasksExcept(taskId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const rows = await sql`
    SELECT t.id, t.title, t.is_private FROM tasks t WHERE t.id != ${taskId} AND ${vis} ORDER BY t.title
  `;
  return rows.map((r) => ({ id: r.id, title: r.title, is_private: !!r.is_private }));
}

export async function fetchActiveEmployees() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(is_private = false OR created_by = ${userId})`
    : sql`is_private = false`;
  const rows = await sql`
    SELECT id, first_name, last_name, is_private
    FROM employees
    WHERE status = 'active' AND ${vis}
    ORDER BY first_name
  `;
  return rows.map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, is_private: !!r.is_private }));
}

export async function fetchAllContacts() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(is_private = false OR created_by = ${userId})`
    : sql`is_private = false`;
  const rows = await sql`
    SELECT id, first_name, last_name, company, is_private
    FROM contacts
    WHERE ${vis}
    ORDER BY first_name
  `;
  return rows.map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, company: r.company, is_private: !!r.is_private }));
}

export async function fetchAllProjects() {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  const rows = await sql`
    SELECT p.id, p.name, p.is_private FROM projects p WHERE ${vis} ORDER BY p.name
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, is_private: !!r.is_private }));
}

export async function fetchLinkedProjects(taskId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(p.is_private = false OR p.created_by = ${userId})`
    : sql`p.is_private = false`;
  const links = await sql`
    SELECT pt.project_id, p.id, p.name
    FROM project_tasks pt
    JOIN projects p ON p.id = pt.project_id
    WHERE pt.task_id = ${taskId} AND ${vis}
  `;
  return links.map((r) => ({ id: r.id, name: r.name }));
}

export async function fetchChildTasks(taskId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const rows = await sql`
    SELECT t.id, t.title, t.status FROM tasks t WHERE t.parent_task_id = ${taskId} AND ${vis}
  `;
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status }));
}

export async function fetchActiveTaskTypes() {
  const rows = await sql`
    SELECT id, name, color
    FROM task_types
    WHERE is_active = true
    ORDER BY name
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }));
}

export async function fetchTaskNotes(taskId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(n.is_private = false OR n.created_by = ${userId})`
    : sql`n.is_private = false`;
  const rows = await sql`
    SELECT n.* FROM notes_standalone n
    WHERE n.task_id = ${taskId} AND ${vis}
    ORDER BY n.created_at DESC
  `;
  return rows.map((r) => ({ ...r }));
}

export async function fetchSeriesTasks(sourceId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const rows = await sql`
    SELECT t.id, t.title, t.status, t.due_date
    FROM tasks t
    WHERE (t.recurrence_source_task_id = ${sourceId} OR t.id = ${sourceId}) AND ${vis}
    ORDER BY t.due_date ASC
  `;
  return rows.map((r) => ({ id: r.id, title: r.title, status: r.status, due_date: r.due_date }));
}

export async function fetchWorkflowChain(templateId: string) {
  const [allTemplates, steps] = await Promise.all([
    sql`SELECT id, name FROM task_templates ORDER BY name`,
    sql`SELECT template_id, next_template_id, delay_days FROM task_workflow_steps`,
  ]);
  if (!allTemplates.length || !steps.length) return [];

  const tmplMap: Record<string, string> = {};
  for (const t of allTemplates) tmplMap[t.id] = t.name;

  const stepMap: Record<string, { next_template_id: string; delay_days: number }> = {};
  for (const s of steps) stepMap[s.template_id] = { next_template_id: s.next_template_id, delay_days: s.delay_days };

  const allTemplateIds = allTemplates.map((t) => t.id);
  const nextIds = new Set(steps.map((s) => s.next_template_id));
  const roots = allTemplateIds.filter((id: string) => !nextIds.has(id) && stepMap[id]);

  let chain: { id: string; name: string; delayDays: number }[] = [];
  for (const rootId of roots) {
    const c: { id: string; name: string; delayDays: number }[] = [{ id: rootId, name: tmplMap[rootId] || rootId, delayDays: 0 }];
    const visited = new Set<string>([rootId]);
    let currentId = rootId;
    let found = currentId === templateId;
    while (currentId) {
      const step = stepMap[currentId];
      if (!step || !step.next_template_id || visited.has(step.next_template_id)) break;
      visited.add(step.next_template_id);
      c.push({ id: step.next_template_id, name: tmplMap[step.next_template_id] || step.next_template_id, delayDays: step.delay_days });
      if (step.next_template_id === templateId) found = true;
      currentId = step.next_template_id;
    }
    if (found && c.length > 1) { chain = c; break; }
  }
  return chain;
}

export async function fetchParentTask(parentTaskId: string) {
  const userId = await currentUserId();
  const vis = userId
    ? sql`(t.is_private = false OR t.created_by = ${userId})`
    : sql`t.is_private = false`;
  const rows = await sql`
    SELECT t.id, t.title FROM tasks t WHERE t.id = ${parentTaskId} AND ${vis}
  `;
  return rows[0] ? { id: rows[0].id, title: rows[0].title } : null;
}

export async function fetchTemplateName(templateId: string) {
  const rows = await sql`
    SELECT name FROM task_templates WHERE id = ${templateId}
  `;
  return rows[0]?.name || null;
}

export async function addDependency(taskId: string, data: {
  depends_on_task_id: string;
  dependency_type: string;
  lag_days: number;
}) {
  await sql`INSERT INTO task_dependencies ${sql({ task_id: taskId, ...data })}`;
}

export async function deleteDependency(depId: string) {
  await sql`DELETE FROM task_dependencies WHERE id = ${depId}`;
}

export async function updateTask(taskId: string, data: Record<string, unknown>) {
  await sql`UPDATE tasks SET ${sql(data as Record<string, string>)} WHERE id = ${taskId}`;
}

export async function replaceTaskAssignees(taskId: string, employeeIds: string[]) {
  await sql`DELETE FROM task_assignees WHERE task_id = ${taskId}`;
  for (const empId of employeeIds) {
    await sql`INSERT INTO task_assignees ${sql({ task_id: taskId, employee_id: empId })}`;
  }
}

export async function replaceProjectLinks(taskId: string, projectIds: string[]) {
  await sql`DELETE FROM project_tasks WHERE task_id = ${taskId}`;
  for (const pid of projectIds) {
    await sql`INSERT INTO project_tasks ${sql({ task_id: taskId, project_id: pid })}`;
  }
}

export async function createFollowUpTask(data: {
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  contact_id: string | null;
  parent_task_id: string;
  template_id: string;
  task_type_id: string | null;
}) {
  const user = await getSessionUser();
  const insertData = { ...data, created_by: user?.id };
  await sql`INSERT INTO tasks ${sql(insertData)}`;
}

export async function fetchFollowUpTemplate(templateId: string) {
  const steps = await sql`
    SELECT step_order, delay_days, next_template_id
    FROM task_workflow_steps
    WHERE template_id = ${templateId}
    ORDER BY step_order ASC
    LIMIT 1
  `;
  if (steps.length === 0) return null;

  const step = steps[0];
  const tmpl = await sql`
    SELECT id, name, description, default_priority, due_amount, due_unit, default_due_days, task_type_id
    FROM task_templates
    WHERE id = ${step.next_template_id}
  `;
  if (tmpl.length === 0) return null;

  return {
    step: { delay_days: step.delay_days },
    template: {
      id: tmpl[0].id,
      name: tmpl[0].name,
      description: tmpl[0].description,
      default_priority: tmpl[0].default_priority,
      due_amount: tmpl[0].due_amount,
      due_unit: tmpl[0].due_unit,
      default_due_days: tmpl[0].default_due_days,
      task_type_id: tmpl[0].task_type_id,
    },
  };
}

export async function removeEmployee(taskId: string, employeeId: string) {
  await sql`DELETE FROM task_assignees WHERE task_id = ${taskId} AND employee_id = ${employeeId}`;
}

export async function addEmployee(taskId: string, employeeId: string) {
  await sql`INSERT INTO task_assignees ${sql({ task_id: taskId, employee_id: employeeId })}`;
}

export async function changeContact(taskId: string, contactId: string | null) {
  await sql`UPDATE tasks SET contact_id = ${contactId} WHERE id = ${taskId}`;
}

export async function removeProjectLink(taskId: string, projectId: string) {
  await sql`DELETE FROM project_tasks WHERE task_id = ${taskId} AND project_id = ${projectId}`;
}

export async function addProjectLink(taskId: string, projectId: string) {
  await sql`INSERT INTO project_tasks ${sql({ task_id: taskId, project_id: projectId })}`;
}

export async function checkDependentTasks(taskId: string) {
  const deps = await sql`
    SELECT task_id FROM task_dependencies WHERE depends_on_task_id = ${taskId}
  `;
  if (deps.length === 0) return [];
  const depTaskIds = deps.map((d) => d.task_id);
  const tasks = await sql`
    SELECT id, title FROM tasks WHERE id = ANY(${depTaskIds})
  `;
  return tasks.map((t) => ({ id: t.id, title: t.title }));
}

export async function deleteTask(taskId: string) {
  // Clean up all related records
  await Promise.all([
    sql`DELETE FROM task_assignees WHERE task_id = ${taskId}`,
    sql`DELETE FROM task_dependencies WHERE task_id = ${taskId}`,
    sql`DELETE FROM task_dependencies WHERE depends_on_task_id = ${taskId}`,
    sql`DELETE FROM project_tasks WHERE task_id = ${taskId}`,
  ]);

  // Clear parent_task_id on child tasks
  await sql`UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id = ${taskId}`;

  const rows = await sql`DELETE FROM tasks WHERE id = ${taskId} RETURNING id`;
  if (rows.length === 0) throw new Error("Failed to delete task");
}

export async function updateTaskFieldInline(taskId: string, field: string, value: string, completedAt?: string) {
  if (field === "status" && value === "completed" && completedAt) {
    await sql`UPDATE tasks SET status = 'completed', completed_at = ${completedAt} WHERE id = ${taskId}`;
  } else if (field === "priority") {
    await sql`UPDATE tasks SET priority = ${value} WHERE id = ${taskId}`;
  } else if (field === "status") {
    await sql`UPDATE tasks SET status = ${value} WHERE id = ${taskId}`;
  }
}

export async function addTaskNote(taskId: string, content: string) {
  await sql`INSERT INTO notes_standalone ${sql({ task_id: taskId, content })}`;
}

export async function deleteTaskNote(noteId: string) {
  await sql`DELETE FROM notes_standalone WHERE id = ${noteId}`;
}
