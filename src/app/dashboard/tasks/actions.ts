"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function fetchAllTasks() {
  const rows = await sql`
    SELECT t.*,
           c.id as contact_id_ref, c.first_name as contact_first_name,
           c.last_name as contact_last_name, c.company as contact_company
    FROM tasks t
    LEFT JOIN contacts c ON c.id = t.contact_id
    ORDER BY t.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    contact_id: r.contact_id,
    priority: r.priority,
    status: r.status,
    start_date: r.start_date,
    due_date: r.due_date,
    is_milestone: r.is_milestone,
    is_recurring: r.is_recurring,
    template_id: r.template_id,
    recurrence_source_task_id: r.recurrence_source_task_id,
    task_type_id: r.task_type_id,
    created_at: r.created_at,
    contacts: r.contact_id_ref
      ? { id: r.contact_id_ref, first_name: r.contact_first_name, last_name: r.contact_last_name, company: r.contact_company }
      : null,
    task_assignees: [] as { employee_id: string; employees: { id: string; first_name: string; last_name: string } }[],
  }));
}

export async function fetchTaskAssignees(taskIds: string[]) {
  if (taskIds.length === 0) return {};
  const rows = await sql`
    SELECT ta.task_id, ta.employee_id, e.id as emp_id, e.first_name, e.last_name
    FROM task_assignees ta
    JOIN employees e ON e.id = ta.employee_id
    WHERE ta.task_id = ANY(${taskIds})
  `;
  const map: Record<string, { employee_id: string; employees: { id: string; first_name: string; last_name: string } }[]> = {};
  for (const r of rows) {
    if (!map[r.task_id]) map[r.task_id] = [];
    map[r.task_id].push({
      employee_id: r.employee_id,
      employees: { id: r.emp_id, first_name: r.first_name, last_name: r.last_name },
    });
  }
  return map;
}

export async function fetchTaskProjectMap(taskIds: string[]) {
  if (taskIds.length === 0) return {};
  const rows = await sql`
    SELECT pt.task_id, pt.project_id, p.name
    FROM project_tasks pt
    JOIN projects p ON p.id = pt.project_id
    WHERE pt.task_id = ANY(${taskIds})
  `;
  const map: Record<string, { id: string; name: string }[]> = {};
  for (const r of rows) {
    if (!map[r.task_id]) map[r.task_id] = [];
    map[r.task_id].push({ id: r.project_id, name: r.name });
  }
  return map;
}

export async function fetchActiveEmployees() {
  const rows = await sql`
    SELECT id, first_name, last_name
    FROM employees
    WHERE status = 'active'
    ORDER BY first_name
  `;
  return rows.map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name }));
}

export async function fetchAllProjects() {
  const rows = await sql`
    SELECT id, name FROM projects ORDER BY name
  `;
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function fetchAllContacts() {
  const rows = await sql`
    SELECT id, first_name, last_name, company
    FROM contacts
    ORDER BY first_name
  `;
  return rows.map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, company: r.company }));
}

export async function fetchTaskTemplates() {
  const rows = await sql`
    SELECT id, name, description, default_priority, default_due_days,
           due_amount, due_unit, task_type_id, is_recurring,
           recurrence_frequency, recurrence_unit, recurrence_count
    FROM task_templates
    ORDER BY name
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    default_priority: r.default_priority,
    default_due_days: r.default_due_days,
    due_amount: r.due_amount,
    due_unit: r.due_unit,
    task_type_id: r.task_type_id,
    is_recurring: r.is_recurring,
    recurrence_frequency: r.recurrence_frequency,
    recurrence_unit: r.recurrence_unit,
    recurrence_count: r.recurrence_count,
  }));
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

export async function fetchWorkflowSteps() {
  const rows = await sql`
    SELECT template_id, next_template_id, delay_days
    FROM task_workflow_steps
  `;
  return rows.map((r) => ({
    template_id: r.template_id,
    next_template_id: r.next_template_id,
    delay_days: r.delay_days,
  }));
}

export async function createTask(data: {
  title: string;
  description: string | null;
  contact_id: string | null;
  priority: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  task_type_id?: string | null;
  template_id?: string | null;
  is_recurring?: boolean;
  recurrence_frequency?: number | null;
  recurrence_unit?: string | null;
  recurrence_source_task_id?: string | null;
  parent_task_id?: string | null;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be logged in to create a task.");

  const insertData = {
    ...data,
    created_by: user.id,
  };

  const rows = await sql`INSERT INTO tasks ${sql(insertData)} RETURNING *`;
  return rows[0];
}

export async function insertTaskAssignees(taskId: string, employeeIds: string[]) {
  if (employeeIds.length === 0) return;
  const rows = employeeIds.map((empId) => ({ task_id: taskId, employee_id: empId }));
  for (const row of rows) {
    await sql`INSERT INTO task_assignees ${sql(row)}`;
  }
}

export async function insertProjectTask(taskId: string, projectId: string) {
  await sql`INSERT INTO project_tasks ${sql({ task_id: taskId, project_id: projectId })}`;
}

export async function updateTask(taskId: string, data: Record<string, unknown>) {
  await sql`UPDATE tasks SET ${sql(data as Record<string, string>)} WHERE id = ${taskId}`;
}

export async function updateTaskField(taskId: string, field: string, value: string, completedAt?: string) {
  if (field === "status" && value === "completed" && completedAt) {
    await sql`UPDATE tasks SET status = 'completed', completed_at = ${completedAt} WHERE id = ${taskId}`;
  } else if (field === "priority") {
    await sql`UPDATE tasks SET priority = ${value} WHERE id = ${taskId}`;
  } else if (field === "status") {
    await sql`UPDATE tasks SET status = ${value} WHERE id = ${taskId}`;
  }
}

export async function checkChildTaskCount(taskId: string) {
  const rows = await sql`SELECT COUNT(*) as count FROM tasks WHERE parent_task_id = ${taskId}`;
  return Number(rows[0]?.count ?? 0);
}

export async function deleteTask(taskId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be signed in to delete tasks");

  // Clean up related records
  await Promise.all([
    sql`DELETE FROM task_assignees WHERE task_id = ${taskId}`,
    sql`DELETE FROM project_tasks WHERE task_id = ${taskId}`,
  ]);

  // Delete the task
  const rows = await sql`DELETE FROM tasks WHERE id = ${taskId} RETURNING id`;
  if (rows.length === 0) throw new Error("Failed to delete task.");

  // Verify deletion
  const check = await sql`SELECT id FROM tasks WHERE id = ${taskId}`;
  if (check.length > 0) throw new Error("Failed to delete task.");
}

export async function bulkCreateTask(data: {
  title: string;
  description: string | null;
  priority: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  is_milestone: boolean;
  contact_id: string | null;
  task_type_id: string | null;
}, employeeIds: string[], projectId: string | null) {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");

  const insertData = { ...data, created_by: user.id };
  const rows = await sql`INSERT INTO tasks ${sql(insertData)} RETURNING *`;
  const task = rows[0];
  if (!task) throw new Error("Failed to create task");

  if (employeeIds.length > 0) {
    for (const empId of employeeIds) {
      await sql`INSERT INTO task_assignees ${sql({ task_id: task.id, employee_id: empId })}`;
    }
  }

  if (projectId) {
    await sql`INSERT INTO project_tasks ${sql({ task_id: task.id, project_id: projectId })}`;
  }

  return task;
}
