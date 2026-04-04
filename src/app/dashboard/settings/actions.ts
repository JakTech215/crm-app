"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// ---- Contact Statuses ----

export async function fetchContactStatuses() {
  return await sql`SELECT * FROM contact_statuses ORDER BY name`;
}

export async function saveContactStatus(id: string | null, data: { name: string; color: string; description: string | null }) {
  if (id) {
    await sql`UPDATE contact_statuses SET ${sql(data)} WHERE id = ${id}`;
  } else {
    await sql`INSERT INTO contact_statuses ${sql(data)}`;
  }
}

export async function deleteContactStatus(id: string) {
  await sql`DELETE FROM contact_statuses WHERE id = ${id}`;
}

// ---- Project Statuses ----

export async function fetchProjectStatuses() {
  return await sql`SELECT * FROM project_statuses ORDER BY name`;
}

export async function saveProjectStatus(id: string | null, data: { name: string; color: string; description: string | null }) {
  if (id) {
    await sql`UPDATE project_statuses SET ${sql(data)} WHERE id = ${id}`;
  } else {
    await sql`INSERT INTO project_statuses ${sql(data)}`;
  }
}

export async function deleteProjectStatus(id: string) {
  await sql`DELETE FROM project_statuses WHERE id = ${id}`;
}

// ---- Task Types ----

export async function fetchTaskTypes() {
  return await sql`SELECT * FROM task_types ORDER BY name`;
}

export async function saveTaskType(id: string | null, data: { name: string; color: string; is_active: boolean }) {
  if (id) {
    await sql`UPDATE task_types SET ${sql(data)} WHERE id = ${id}`;
  } else {
    await sql`INSERT INTO task_types ${sql(data)}`;
  }
}

export async function deleteTaskType(id: string) {
  await sql`DELETE FROM task_types WHERE id = ${id}`;
}

// ---- Task Templates ----

export async function fetchTaskTemplates() {
  return await sql`SELECT * FROM task_templates ORDER BY name`;
}

export async function fetchWorkflowSteps() {
  return await sql`SELECT * FROM task_workflow_steps ORDER BY step_order`;
}

export async function fetchActiveTaskTypes() {
  return await sql`SELECT id, name, color, is_active FROM task_types WHERE is_active = true ORDER BY name`;
}

export async function saveTaskTemplate(
  id: string | null,
  payload: Record<string, unknown>,
  steps: { next_template_id: string; delay_days: number; trigger_condition: string }[]
) {
  let templateId = id;

  if (id) {
    await sql`UPDATE task_templates SET ${sql(payload)} WHERE id = ${id}`;
  } else {
    const rows = await sql`INSERT INTO task_templates ${sql(payload)} RETURNING id`;
    templateId = rows[0].id;
  }

  // Save workflow steps
  if (templateId) {
    await sql`DELETE FROM task_workflow_steps WHERE template_id = ${templateId}`;
    const validSteps = steps.filter((s) => s.next_template_id);
    if (validSteps.length > 0) {
      const stepRows = validSteps.map((s, i) => ({
        template_id: templateId as string,
        step_order: i + 1,
        next_template_id: s.next_template_id,
        delay_days: s.delay_days,
        trigger_condition: s.trigger_condition,
      }));
      await sql`INSERT INTO task_workflow_steps ${sql(stepRows)}`;
    }
  }

  return templateId;
}

export async function deleteTaskTemplate(id: string) {
  await sql`DELETE FROM task_workflow_steps WHERE template_id = ${id}`;
  await sql`DELETE FROM task_templates WHERE id = ${id}`;
}

// ---- User Management ----

export async function checkIsAdmin() {
  const user = await getSessionUser();
  if (!user) return false;
  return user.role === "admin";
}

// ---- Holidays ----

export async function fetchHolidays() {
  return await sql`SELECT * FROM holidays ORDER BY holiday_date ASC`;
}

export async function saveHoliday(
  id: string | null,
  data: {
    name: string;
    holiday_date: string;
    holiday_type: string;
    is_recurring: boolean;
    description: string | null;
  }
) {
  const user = await getSessionUser();
  if (id) {
    await sql`UPDATE holidays SET ${sql({ ...data, updated_at: new Date().toISOString() })} WHERE id = ${id}`;
  } else {
    await sql`INSERT INTO holidays ${sql({ ...data, created_by: user?.id })}`;
  }
}

export async function deleteHoliday(id: string) {
  await sql`DELETE FROM holidays WHERE id = ${id}`;
}

export async function upsertFederalHoliday(data: { name: string; holiday_date: string; holiday_type: string; is_recurring: boolean; created_by: string | null }) {
  // Use ON CONFLICT to upsert
  await sql`
    INSERT INTO holidays (name, holiday_date, holiday_type, is_recurring, created_by)
    VALUES (${data.name}, ${data.holiday_date}, ${data.holiday_type}, ${data.is_recurring}, ${data.created_by})
    ON CONFLICT (holiday_date, name) DO NOTHING
  `;
}

export async function getCurrentUserId() {
  const user = await getSessionUser();
  return user?.id || null;
}
