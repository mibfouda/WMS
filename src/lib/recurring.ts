import { db } from "@/lib/wm";

// Recurring route templates, stored in the `recurring_routes` table.
// The database itself creates each day's tasks (pg_cron → generate_recurring_tasks).
export type RouteTemplate = {
  id: string;
  name: string;
  driver_id: number;
  bin_ids: number[]; // in stop order
  weekdays: number[]; // 0=Sun … 6=Sat
  start_date: string; // yyyy-MM-dd
  end_date: string | null; // null = forever
  active: boolean;
};

const LEGACY_KEY = "wasteops-recurring-routes";

export async function fetchTemplates(): Promise<RouteTemplate[]> {
  const { data, error } = await db.from("recurring_routes").select("id,name,driver_id,bin_ids,weekdays,start_date,end_date,active").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as RouteTemplate[];
}
export async function insertTemplate(t: Omit<RouteTemplate, "id">) {
  const { error } = await db.from("recurring_routes").insert(t);
  if (error) throw new Error(error.message);
}
export async function updateTemplate(id: string, patch: Partial<RouteTemplate>) {
  const { error } = await db.from("recurring_routes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteTemplate(id: string) {
  const { error } = await db.from("recurring_routes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
/** Safety net: ask the database to create today's tasks now (idempotent). */
export async function runGenerator(): Promise<number> {
  const { data, error } = await db.rpc("generate_recurring_tasks");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
/** Move routes saved in this browser by the earlier version into the table. */
export async function migrateLegacy() {
  if (typeof window === "undefined") return;
  let list: RouteTemplate[] = [];
  try { list = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]"); } catch { return; }
  if (!list.length) return;
  for (const { id: _id, ...t } of list) await insertTemplate(t);
  localStorage.removeItem(LEGACY_KEY);
}

/** Is the template scheduled to run on the given day (yyyy-MM-dd)? Mirrors the SQL function. */
export function isDue(t: RouteTemplate, day: string): boolean {
  if (!t.active || day < t.start_date) return false;
  if (t.end_date && day > t.end_date) return false;
  const wd = new Date(`${day}T12:00:00`).getDay();
  return t.weekdays.includes(wd);
}

/** Containers of a due template that don't already have a task for that driver on that day. */
export function missingStops(
  t: RouteTemplate,
  day: string,
  existing: { driver_id: number; bin_id: number; task_date: string }[],
): { bin_id: number; route_order: number }[] {
  if (!isDue(t, day)) return [];
  const have = new Set(existing.filter((e) => e.task_date === day && e.driver_id === t.driver_id).map((e) => e.bin_id));
  return t.bin_ids.map((bin_id, i) => ({ bin_id, route_order: i + 1 })).filter((s) => !have.has(s.bin_id));
}
