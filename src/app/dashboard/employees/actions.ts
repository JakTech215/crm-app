"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchEmployees(): Promise<any[]> {
  const rows = await sql`SELECT * FROM employees ORDER BY created_at DESC`;
  return rows as unknown as any[];
}

export async function fetchEmployeeTasksMap(today: string) {
  const assignments = await sql`SELECT task_id, employee_id FROM task_assignees`;
  if (assignments.length === 0) return {};

  const taskIds = [...new Set(assignments.map((a) => a.task_id))];

  const tasks = await sql`
    SELECT id, title, due_date FROM tasks
    WHERE id = ANY(${taskIds})
      AND status != 'completed'
      AND status != 'cancelled'
      AND due_date >= ${today}
    ORDER BY due_date ASC
  `;

  const taskById: Record<string, { id: string; title: string; due_date: string | null }> = {};
  for (const t of tasks) taskById[t.id] = { id: t.id, title: t.title, due_date: t.due_date };

  const raw: Record<string, { id: string; title: string; due_date: string | null }[]> = {};
  for (const a of assignments) {
    const task = taskById[a.task_id];
    if (!task) continue;
    if (!raw[a.employee_id]) raw[a.employee_id] = [];
    raw[a.employee_id].push(task);
  }

  const map: Record<string, { id: string; title: string; due_date: string | null }[]> = {};
  for (const [empId, empTasks] of Object.entries(raw)) {
    map[empId] = empTasks
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 3);
  }
  return map;
}

export async function createEmployee(form: {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department: string;
  status: string;
}) {
  const user = await getSessionUser();

  const data = {
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email,
    role: form.role || null,
    department: form.department || null,
    status: form.status,
    created_by: user?.id,
  };

  await sql`INSERT INTO employees ${sql(data)}`;
}
