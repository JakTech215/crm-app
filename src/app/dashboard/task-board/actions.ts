"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function fetchBoardTasks() {
  const rows = await sql`
    SELECT t.*,
           c.id as contact_id_ref, c.first_name as contact_first_name,
           c.last_name as contact_last_name, c.company as contact_company
    FROM tasks t
    LEFT JOIN contacts c ON c.id = t.contact_id
    ORDER BY t.due_date ASC NULLS LAST
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

export async function fetchActiveEmployees() {
  const rows = await sql`
    SELECT id, first_name, last_name
    FROM employees
    WHERE status = 'active'
    ORDER BY first_name
  `;
  return rows.map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name }));
}

export async function fetchAllContacts() {
  const rows = await sql`
    SELECT id, first_name, last_name, company
    FROM contacts
    ORDER BY first_name
  `;
  return rows.map((r) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, company: r.company }));
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

export async function fetchAllProjects() {
  const rows = await sql`
    SELECT id, name FROM projects ORDER BY name
  `;
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export async function completeTask(taskId: string, completedAt: string) {
  await sql`UPDATE tasks SET status = 'completed', completed_at = ${completedAt} WHERE id = ${taskId}`;
}

export async function updateTaskStatus(taskId: string, status: string, completedAt?: string) {
  if (status === "completed" && completedAt) {
    await sql`UPDATE tasks SET status = 'completed', completed_at = ${completedAt} WHERE id = ${taskId}`;
  } else {
    await sql`UPDATE tasks SET status = ${status} WHERE id = ${taskId}`;
  }
}

export async function updateTaskPriority(taskId: string, priority: string) {
  await sql`UPDATE tasks SET priority = ${priority} WHERE id = ${taskId}`;
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
}, employeeIds: string[], projectId: string | null) {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be logged in.");

  const insertData = { ...data, created_by: user.id };
  const rows = await sql`INSERT INTO tasks ${sql(insertData)} RETURNING *`;
  const task = rows[0];

  if (task && employeeIds.length > 0) {
    for (const empId of employeeIds) {
      await sql`INSERT INTO task_assignees ${sql({ task_id: task.id, employee_id: empId })}`;
    }
  }

  if (task && projectId) {
    await sql`INSERT INTO project_tasks ${sql({ task_id: task.id, project_id: projectId })}`;
  }

  return task;
}
