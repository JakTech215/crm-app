import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import sql from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

async function verifyAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const applied = await sql`SELECT name FROM _migrations ORDER BY name`;
    const appliedSet = new Set(applied.map((r) => r.name));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    const pending = files.filter((f) => !appliedSet.has(f));

    return NextResponse.json({
      applied: files.filter((f) => appliedSet.has(f)),
      pending,
      total: files.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    const applied = await sql`SELECT name FROM _migrations ORDER BY name`;
    const appliedSet = new Set(applied.map((r) => r.name));

    const body = await request.json().catch(() => ({}));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    // Mark files as applied without running them
    if (body.markApplied) {
      const toMark: string[] = body.markApplied === "all"
        ? files.filter((f) => !appliedSet.has(f))
        : Array.isArray(body.markApplied) ? body.markApplied : [body.markApplied];
      const results: { file: string; status: string }[] = [];
      for (const file of toMark) {
        if (appliedSet.has(file)) {
          results.push({ file, status: "already applied" });
        } else {
          await sql`INSERT INTO _migrations (name) VALUES (${file})`;
          results.push({ file, status: "marked as applied" });
        }
      }
      return NextResponse.json({ results });
    }

    let target: string[];
    if (body.file) {
      if (!files.includes(body.file)) {
        return NextResponse.json({ error: `Migration not found: ${body.file}` }, { status: 404 });
      }
      target = [body.file];
    } else {
      target = files.filter((f) => !appliedSet.has(f));
    }

    if (target.length === 0) {
      return NextResponse.json({ message: "No pending migrations", applied: [] });
    }

    const results: { file: string; status: string }[] = [];

    for (const file of target) {
      if (appliedSet.has(file)) {
        results.push({ file, status: "already applied" });
        continue;
      }
      const content = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      try {
        await sql.unsafe(content);
        await sql`INSERT INTO _migrations (name) VALUES (${file})`;
        results.push({ file, status: "applied" });
      } catch (err: any) {
        results.push({ file, status: `error: ${err.message}` });
        break;
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
