import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key for the user's own waste-management database.
const URL = "https://noasqoznemirflbhdsah.supabase.co";
const KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vYXNxb3puZW1pcmZsYmhkc2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MzcwMzMsImV4cCI6MjEwNzExMzAzM30.9l7MdA0PUhsAmiuU33JRv58L4MJ9D45Qcl0vsC8p_GY";

export const db = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "wasteops-auth" } });

export type Bin = {
  bin_id: number;
  bin_code: string;
  latitude: number;
  longitude: number;
  address_description: string | null;
};
export type Driver = { driver_id: number; username: string; truck_number: string; is_active: boolean };
export type Task = {
  task_id: number;
  driver_id: number;
  bin_id: number;
  task_date: string;
  route_order: number | null;
  status: string;
  collected_at: string | null;
  fail_reason: string | null;
  scan_type: string | null;
};
export type DriverLoc = { driver_id: number; latitude: number; longitude: number; timestamp: string };

export type BinState = "collected" | "pending" | "failed" | "none";

export function taskState(status?: string): BinState {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "collected") return "collected";
  if (s === "pending") return "pending";
  if (s === "failed") return "failed";
  return "none";
}

async function q<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const fetchBins = () => q<Bin[]>(db.from("bins").select("bin_id,bin_code,latitude,longitude,address_description").order("bin_id"));
export const fetchDrivers = () => q<Driver[]>(db.from("drivers").select("driver_id,username,truck_number,is_active").order("driver_id"));
export const fetchTasks = (from?: string, to?: string, driverId?: number) => {
  let r = db.from("daily_tasks").select("*").order("task_date", { ascending: false }).order("task_id", { ascending: false });
  if (from) r = r.gte("task_date", from);
  if (to) r = r.lte("task_date", to);
  if (driverId) r = r.eq("driver_id", driverId);
  return q<Task[]>(r.limit(5000));
};
export const fetchLatestLocations = async () => {
  const rows = await q<DriverLoc[]>(db.from("driver_locations").select("driver_id,latitude,longitude,timestamp").order("timestamp", { ascending: false }).limit(1000));
  const seen = new Map<number, DriverLoc>();
  for (const r of rows) if (!seen.has(r.driver_id)) seen.set(r.driver_id, r);
  return [...seen.values()];
};
export const createTask = (t: { driver_id: number; bin_id: number; task_date: string; route_order: number }) =>
  q(db.from("daily_tasks").insert({ ...t, status: "Pending" }));
export const addDriver = (d: { username: string; truck_number: string; password_hash: string }) =>
  q(db.from("drivers").insert({ ...d, is_active: true }));
export const updateBin = (binId: number, b: { bin_code: string; address_description: string | null; latitude: number; longitude: number }) =>
  q(db.from("bins").update(b).eq("bin_id", binId));
export const addBin = (b: { bin_code: string; address_description: string | null; latitude: number; longitude: number }) =>
  q(db.from("bins").insert(b));
export const fetchLocationHistory = (driverId: number, date: string) =>
  q<DriverLoc[]>(
    db.from("driver_locations").select("driver_id,latitude,longitude,timestamp")
      .eq("driver_id", driverId).gte("timestamp", `${date}T00:00:00`).lte("timestamp", `${date}T23:59:59`)
      .order("timestamp", { ascending: true }).limit(5000),
  );
