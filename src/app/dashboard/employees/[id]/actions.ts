"use server";

import sql from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchEmployee(employeeId: string): Promise<any | null> {
  const rows = await sql`SELECT * FROM employees WHERE id = ${employeeId}`;
  return (rows[0] as unknown) || null;
}

export async function fetchEmployeeTasks(employeeId: string) {
  const assignments = await sql`SELECT task_id FROM task_assignees WHERE employee_id = ${employeeId}`;
  if (assignments.length === 0) return [];

  const taskIds = assignments.map((a) => a.task_id);

  const tasks = await sql`
    SELECT t.id, t.title, t.status, t.priority, t.start_date, t.due_date, t.contact_id,
           c.first_name as contact_first_name, c.last_name as contact_last_name, c.company as contact_company
    FROM tasks t
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE t.id = ANY(${taskIds})
    ORDER BY t.due_date ASC
  `;

  // Fetch project links
  const projectLinks = await sql`SELECT task_id, project_id FROM project_tasks WHERE task_id = ANY(${taskIds})`;

  const projectNameMap: Record<string, string> = {};
  if (projectLinks.length > 0) {
    const projectIds = [...new Set(projectLinks.map((pl) => pl.project_id))];
    const projects = await sql`SELECT id, name FROM projects WHERE id = ANY(${projectIds})`;
    for (const p of projects) projectNameMap[p.id] = p.name;
  }

  const taskProjectMap: Record<string, string> = {};
  for (const pl of projectLinks) {
    if (projectNameMap[pl.project_id]) {
      taskProjectMap[pl.task_id] = projectNameMap[pl.project_id];
    }
  }

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    start_date: t.start_date,
    due_date: t.due_date,
    contact_id: t.contact_id,
    contacts: t.contact_id
      ? { first_name: t.contact_first_name, last_name: t.contact_last_name, company: t.contact_company }
      : null,
    projectName: taskProjectMap[t.id] || null,
  }));
}

export async function fetchAllNonCompletedTasks(): Promise<{ id: string; title: string }[]> {
  const rows = await sql`SELECT id, title FROM tasks WHERE status != 'completed' ORDER BY title`;
  return rows as unknown as { id: string; title: string }[];
}

export async function assignTaskToEmployee(taskId: string, employeeId: string) {
  await sql`INSERT INTO task_assignees (task_id, employee_id) VALUES (${taskId}, ${employeeId})`;
}

export async function removeTaskAssignment(taskId: string, employeeId: string) {
  await sql`DELETE FROM task_assignees WHERE task_id = ${taskId} AND employee_id = ${employeeId}`;
}

export async function updateTaskField(taskId: string, field: string, value: string) {
  await sql`UPDATE tasks SET ${sql({ [field]: value })} WHERE id = ${taskId}`;
}

export async function fetchEmployeeEvents(employeeId: string) {
  const attendeeData = await sql`
    SELECT ea.event_id, e.*, p.id as project_id_ref, p.name as project_name,
           c.first_name as contact_first_name, c.last_name as contact_last_name
    FROM event_attendees ea
    JOIN events e ON ea.event_id = e.id
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN contacts c ON e.contact_id = c.id
    WHERE ea.employee_id = ${employeeId}
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (attendeeData as unknown as any[])
    .map((a) => ({
      ...a,
      projects: a.project_id_ref ? { id: a.project_id_ref, name: a.project_name } : null,
      contacts: a.contact_first_name ? { first_name: a.contact_first_name, last_name: a.contact_last_name } : null,
    }))
    .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
}

export async function updateEventStatus(eventId: string, newStatus: string) {
  await sql`UPDATE events SET status = ${newStatus} WHERE id = ${eventId}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchEmployeeNotes(employeeId: string): Promise<any[]> {
  const rows = await sql`SELECT * FROM notes_standalone WHERE employee_id = ${employeeId} ORDER BY created_at DESC`;
  return rows as unknown as any[];
}

export async function addEmployeeNote(employeeId: string, content: string) {
  await sql`INSERT INTO notes_standalone (content, employee_id) VALUES (${content}, ${employeeId})`;
}

export async function deleteEmployeeNote(noteId: string) {
  await sql`DELETE FROM notes_standalone WHERE id = ${noteId}`;
}

export async function updateEmployee(
  employeeId: string,
  form: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    department: string;
    status: string;
  }
) {
  const data = {
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email,
    role: form.role || null,
    department: form.department || null,
    status: form.status,
  };
  await sql`UPDATE employees SET ${sql(data)} WHERE id = ${employeeId}`;
}

export async function checkEmployeeDependencies(employeeId: string): Promise<{ id: string; title: string }[]> {
  const assignments = await sql`SELECT task_id FROM task_assignees WHERE employee_id = ${employeeId}`;
  if (assignments.length === 0) return [];
  const taskIds = assignments.map((a) => a.task_id);
  const rows = await sql`SELECT id, title FROM tasks WHERE id = ANY(${taskIds})`;
  return rows as unknown as { id: string; title: string }[];
}

export async function deleteEmployee(employeeId: string) {
  await sql`DELETE FROM task_assignees WHERE employee_id = ${employeeId}`;
  await sql`DELETE FROM employees WHERE id = ${employeeId}`;
}
