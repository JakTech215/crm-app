"use server";

import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchContacts(): Promise<any[]> {
  const rows = await sql`SELECT * FROM contacts ORDER BY created_at DESC`;
  return rows as unknown as any[];
}

export async function fetchContactTasks(today: string) {
  const rows = await sql`
    SELECT id, title, due_date, contact_id
    FROM tasks
    WHERE status != 'completed'
      AND contact_id IS NOT NULL
      AND due_date >= ${today}
    ORDER BY due_date ASC
  `;

  const map: Record<string, { id: string; title: string; due_date: string | null }[]> = {};
  for (const t of rows) {
    if (!t.contact_id) continue;
    if (!map[t.contact_id]) map[t.contact_id] = [];
    if (map[t.contact_id].length < 3) {
      map[t.contact_id].push({ id: t.id, title: t.title, due_date: t.due_date });
    }
  }
  return map;
}

export async function fetchContactStatuses(): Promise<{ id: string; name: string; color: string }[]> {
  const rows = await sql`SELECT id, name, color FROM contact_statuses ORDER BY name`;
  return rows as unknown as { id: string; name: string; color: string }[];
}

export async function createContact(form: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
}) {
  const user = await getSessionUser();

  const data = {
    first_name: form.first_name,
    last_name: form.last_name || null,
    email: form.email || null,
    phone: form.phone || null,
    company: form.company || null,
    status: form.status || "active",
    created_by: user?.id,
  };

  await sql`INSERT INTO contacts ${sql(data)}`;
}
