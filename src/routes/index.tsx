import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Clock, Send, RefreshCw, Plus, X, Play, Pause, RotateCcw } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { AddBinDialog } from "@/components/AddBinDialog";
import { Button } from "@/components/ui/button";
import { AssignTaskDialog } from "@/components/AssignTaskDialog";
import { EditBinDialog } from "@/components/EditBinDialog";
import { fetchBins, fetchDrivers, fetchLatestLocations, fetchTasks, fetchLocationHistory, taskState, createTask, type Bin, type BinState } from "@/lib/wm";
import { RecurringRoutesDialog, useTemplates } from "@/components/RecurringRoutesDialog";
import { Repeat } from "lucide-react";
import { useRef } from "react";

const FleetMap = lazy(() => import("@/components/FleetMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Map — WasteOps Dashboard" },
      { name: "description", content: "Live map of waste containers, their collection status and truck locations." },
      { property: "og:title", content: "Live Map — WasteOps Dashboard" },
      { property: "og:description", content: "Track containers and trucks in real time and dispatch tasks to drivers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveMap,
});

function LiveMap() {
  const qc = useQueryClient();
  const bins = useQuery({ queryKey: ["bins"], queryFn: fetchBins });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers });
  const locs = useQuery({ queryKey: ["locs"], queryFn: fetchLatestLocations, refetchInterval: 15000 });
  const tasks = useQuery({ queryKey: ["tasks-all"], queryFn: () => fetchTasks(), refetchInterval: 15000 });
  const [open, setOpen] = useState(false);
  const [recOpen, setRecOpen] = useState(false);
  const templates = useTemplates().data ?? [];
  const [binId, setBinId] = useState<number>();
  const [editBin, setEditBin] = useState<Bin | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [newPoint, setNewPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [day, setDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [routeDriver, setRouteDriver] = useState<string>("none");
  const [histDriver, setHistDriver] = useState<string>("none");
  const history = useQuery({
    queryKey: ["hist", histDriver, day],
    queryFn: () => fetchLocationHistory(Number(histDriver), day),
    enabled: histDriver !== "none",
  });

  const states = useMemo(() => {
    const m = new Map<number, BinState>();
    for (const t of tasks.data ?? []) if (!m.has(t.bin_id)) m.set(t.bin_id, taskState(t.status)); // tasks are sorted newest first
    return m;
  }, [tasks.data]);

  const counts = useMemo(() => {
    const c = { collected: 0, pending: 0, failed: 0, none: 0 };
    for (const b of bins.data ?? []) c[states.get(b.bin_id) ?? "none"]++;
    return c;
  }, [bins.data, states]);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayTasks = (tasks.data ?? []).filter((t) => t.task_date === today);

  const PALETTE = ["#2563eb", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#65a30d"];
  const routes = useMemo(() => {
    if (routeDriver === "none") return [];
    const byDriver = new Map<number, typeof todayTasks>();
    for (const t of tasks.data ?? []) {
      if (t.task_date !== day) continue;
      if (routeDriver !== "all" && t.driver_id !== Number(routeDriver)) continue;
      byDriver.set(t.driver_id, [...(byDriver.get(t.driver_id) ?? []), t]);
    }
    return [...byDriver.entries()].map(([id, ts], i) => {
      const d = drivers.data?.find((x) => x.driver_id === id);
      const points = ts
        .sort((a, b) => (a.route_order ?? 999) - (b.route_order ?? 999))
        .map((t) => bins.data?.find((b) => b.bin_id === t.bin_id))
        .filter((b): b is Bin => !!b)
        .map((b) => [b.latitude, b.longitude] as [number, number]);
      return { label: `${d?.username ?? id} · ${d?.truck_number ?? ""} planned route`, color: PALETTE[i % PALETTE.length]!, points };
    });
  }, [routeDriver, day, tasks.data, bins.data, drivers.data]);
  const [playIdx, setPlayIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const histLen = history.data?.length ?? 0;
  useEffect(() => { setPlayIdx(0); setPlaying(false); }, [histDriver, day, histLen]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPlayIdx((i) => {
        if (i >= histLen - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 500 / speed);
    return () => clearInterval(id);
  }, [playing, speed, histLen]);
  const cur = history.data?.[playIdx];
  const playhead = useMemo(
    () => (cur ? { pos: [cur.latitude, cur.longitude] as [number, number], label: new Date(cur.timestamp).toLocaleTimeString() } : null),
    [cur],
  );
  const histPoints = useMemo(() => (history.data ?? []).map((l) => [l.latitude, l.longitude] as [number, number]), [history.data]);

  const [overdueHours, setOverdueHours] = useState(48);
  const overdue = useMemo(() => {
    const last = new Map<number, number>();
    for (const t of tasks.data ?? []) {
      if (taskState(t.status) !== "collected") continue;
      const ts = new Date(t.collected_at ?? `${t.task_date}T12:00:00`).getTime();
      if (ts > (last.get(t.bin_id) ?? 0)) last.set(t.bin_id, ts);
    }
    const m = new Map<number, number>();
    const now = Date.now();
    for (const [id, ts] of last) {
      const h = Math.floor((now - ts) / 3600000);
      if (h >= overdueHours) m.set(id, h);
    }
    return m;
  }, [tasks.data, overdueHours]);

  const failedRecent = useMemo(() => {
    const cutoff = Date.now() - 48 * 3600000;
    return (tasks.data ?? []).filter((t) => taskState(t.status) === "failed" && new Date(t.collected_at ?? `${t.task_date}T23:59:59`).getTime() >= cutoff);
  }, [tasks.data]);
  const [seenFailed, setSeenFailed] = useState<Set<number> | null>(null);
  useEffect(() => {
    if (!tasks.data) return;
    const ids = new Set(failedRecent.map((t) => t.task_id));
    if (seenFailed) {
      for (const t of failedRecent) if (!seenFailed.has(t.task_id)) {
        const b = bins.data?.find((x) => x.bin_id === t.bin_id);
        const d = drivers.data?.find((x) => x.driver_id === t.driver_id);
        toast.error(`Collection failed: ${b?.bin_code ?? `Bin #${t.bin_id}`}`, { description: `${d?.username ?? "Driver"} — ${t.fail_reason ?? "No reason given"}`, duration: 10000 });
      }
    }
    setSeenFailed(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedRecent]);

  const refresh = () => qc.invalidateQueries();
  const openAssign = (id?: number) => { setBinId(id); setOpen(true); };
  const openEdit = (id: number) => setEditBin(bins.data?.find((b) => b.bin_id === id) ?? null);

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Live operations</h1>
            <p className="text-sm text-muted-foreground">Containers and trucks, refreshed every 15 seconds.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" /> Refresh</Button>
            <Button variant={addMode ? "destructive" : "outline"} size="sm" onClick={() => setAddMode((v) => !v)}>
              {addMode ? <><X className="h-4 w-4" /> Cancel adding</> : <><Plus className="h-4 w-4" /> Add container</>}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRecOpen(true)}><Repeat className="h-4 w-4" /> Recurring{templates.length ? ` (${templates.length})` : ""}</Button>
            <Button size="sm" onClick={() => openAssign()}><Send className="h-4 w-4" /> Send task</Button>
          </div>
        </div>
        {(failedRecent.length > 0 || overdue.size > 0) && (
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--status-pending)]/40 bg-[color:var(--status-pending)]/10 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-[color:var(--status-pending)]" /> Failed collections (last 48h): {failedRecent.length}</div>
              <ul className="mt-2 flex max-h-32 flex-col gap-1 overflow-auto text-xs">
                {failedRecent.length === 0 && <li className="text-muted-foreground">None 🎉</li>}
                {failedRecent.map((t) => {
                  const b = bins.data?.find((x) => x.bin_id === t.bin_id);
                  const d = drivers.data?.find((x) => x.driver_id === t.driver_id);
                  return <li key={t.task_id}><span className="font-medium">{b?.bin_code ?? `Bin #${t.bin_id}`}</span> · {d?.username} · {t.task_date} — <span className="text-muted-foreground">{t.fail_reason ?? "No reason given"}</span></li>;
                })}
              </ul>
            </div>
            <div className="rounded-xl border border-[color:var(--status-failed)]/40 bg-[color:var(--status-failed)]/10 p-3">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-[color:var(--status-failed)]" /> Overdue containers: {overdue.size}</span>
                <select value={overdueHours} onChange={(e) => setOverdueHours(Number(e.target.value))} className="h-7 rounded-md border border-border bg-background px-1 text-xs" aria-label="Overdue threshold">
                  <option value={48}>&gt; 48h</option><option value={72}>&gt; 72h</option>
                </select>
              </div>
              <ul className="mt-2 flex max-h-32 flex-col gap-1 overflow-auto text-xs">
                {overdue.size === 0 && <li className="text-muted-foreground">All containers collected recently.</li>}
                {[...overdue.entries()].sort((a, b) => b[1] - a[1]).map(([id, h]) => (
                  <li key={id} className="flex justify-between gap-2">
                    <span><span className="font-medium">{bins.data?.find((x) => x.bin_id === id)?.bin_code ?? `Bin #${id}`}</span> · {h}h since last collection</span>
                    <button className="text-primary underline" onClick={() => openAssign(id)}>Assign</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Collected" value={counts.collected} tone="collected" />
          <Stat label="Pending" value={counts.pending} tone="pending" />
          <Stat label="Failed" value={counts.failed} tone="failed" />
          <Stat label="Trucks online" value={locs.data?.length ?? 0} tone="none" />
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="grid gap-1"><span className="text-xs text-muted-foreground">Date</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 min-w-36 justify-start font-normal"><CalendarIcon className="h-4 w-4" /> {day}</Button>
              </PopoverTrigger>
              <PopoverContent className="z-[1200] w-auto p-0" align="start">
                <Calendar mode="single" selected={new Date(`${day}T00:00:00`)} onSelect={(d) => d && setDay(format(d, "yyyy-MM-dd"))} initialFocus />
              </PopoverContent>
            </Popover></div>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Planned route (stops)</span>
            <select value={routeDriver} onChange={(e) => setRouteDriver(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
              <option value="none">Hide</option><option value="all">All drivers</option>
              {(drivers.data ?? []).map((d) => <option key={d.driver_id} value={d.driver_id}>{d.username} · {d.truck_number}</option>)}
            </select></label>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Actual path (GPS history)</span>
            <select value={histDriver} onChange={(e) => setHistDriver(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
              <option value="none">Hide</option>
              {(drivers.data ?? []).map((d) => <option key={d.driver_id} value={d.driver_id}>{d.username} · {d.truck_number}</option>)}
            </select></label>
          {histDriver !== "none" && <span className="pb-2 text-xs text-muted-foreground">{history.isLoading ? "Loading…" : `${histPoints.length} GPS points`}</span>}
          {histDriver !== "none" && histLen > 1 && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button size="sm" variant="outline" onClick={() => { if (playIdx >= histLen - 1) setPlayIdx(0); setPlaying((v) => !v); }}>
                {playing ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Play</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setPlaying(false); setPlayIdx(0); }} aria-label="Restart"><RotateCcw className="h-4 w-4" /></Button>
              <input type="range" min={0} max={histLen - 1} value={playIdx} onChange={(e) => setPlayIdx(Number(e.target.value))} className="min-w-40 flex-1 accent-primary" aria-label="Playback position" />
              <span className="w-24 text-xs tabular-nums text-muted-foreground">{cur ? new Date(cur.timestamp).toLocaleTimeString() : "-"}</span>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="h-9 rounded-md border border-border bg-background px-2 text-sm" aria-label="Playback speed">
                {[0.5, 1, 2, 4, 8, 16].map((v) => <option key={v} value={v}>{v}×</option>)}
              </select>
            </div>
          )}
          {addMode && <span className="pb-2 text-xs font-medium text-primary">Click anywhere on the map to place the new container.</span>}
        </div>
        <div className="h-[560px] overflow-hidden rounded-xl border border-border bg-card">
          <ClientOnly fallback={<div className="grid h-full place-items-center text-muted-foreground">Loading map…</div>}>
            <Suspense fallback={<div className="grid h-full place-items-center text-muted-foreground">Loading map…</div>}>
              <FleetMap bins={bins.data ?? []} states={states} drivers={drivers.data ?? []} locations={locs.data ?? []} onAssign={openAssign} onEdit={openEdit} addMode={addMode} onMapClick={(lat, lng) => { setNewPoint({ lat, lng }); setAddMode(false); }} routes={routes} history={histPoints} overdue={overdue} playhead={histDriver !== "none" ? playhead : null} />
            </Suspense>
          </ClientOnly>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Legend tone="pending" label="Pending" /><Legend tone="collected" label="Collected" /><Legend tone="failed" label="Failed" /><Legend tone="none" label="No task" />
          <span>Green tag = truck (last known position)</span>
        </div>
      </section>

      <aside className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Today's tasks</h2>
        <p className="mb-3 text-xs text-muted-foreground">{today}</p>
        <ul className="flex max-h-[680px] flex-col gap-2 overflow-auto">
          {todayTasks.length === 0 && <li className="text-sm text-muted-foreground">No tasks scheduled today.</li>}
          {todayTasks.map((t) => {
            const b = bins.data?.find((x) => x.bin_id === t.bin_id);
            const d = drivers.data?.find((x) => x.driver_id === t.driver_id);
            const st = taskState(t.status);
            return (
              <li key={t.task_id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{b?.bin_code ?? `Bin #${t.bin_id}`}</span>
                  <span className={`status-pill status-${st}`}>{t.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{d?.username} · {d?.truck_number} · Stop {t.route_order ?? "-"}</p>
              </li>
            );
          })}
        </ul>
      </aside>

      <AssignTaskDialog open={open} onOpenChange={setOpen} bins={bins.data ?? []} drivers={drivers.data ?? []} binId={binId} onDone={refresh} />
      <RecurringRoutesDialog open={recOpen} onOpenChange={setRecOpen} drivers={drivers.data ?? []} />
      <EditBinDialog bin={editBin} open={editBin !== null} onOpenChange={(v) => { if (!v) setEditBin(null); }} onDone={refresh} />
      <AddBinDialog point={newPoint} open={newPoint !== null} onOpenChange={(v) => { if (!v) setNewPoint(null); }} onDone={refresh} />
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: BinState }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <span className={`dot dot-${tone}`} /> {label}
      </div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
    </div>
  );
}

function Legend({ tone, label }: { tone: BinState; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`dot dot-${tone}`} />{label}</span>;
}
