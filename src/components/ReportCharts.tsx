import { useMemo } from "react";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BinState } from "@/lib/wm";

export type ReportRow = { Date: string; Driver: string; Truck: string; Note: string; _st: BinState; _collectedAt: string | null };

const PIE = ["var(--status-pending)", "var(--status-failed)", "var(--primary)", "#6366f1", "#0891b2", "#db2777", "#65a30d", "#78716c"];
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" } };

export function ReportCharts({ rows, from, to }: { rows: ReportRow[]; from: string; to: string }) {
  const daily = useMemo(() => {
    let days: Date[] = [];
    try { days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }); } catch { /* invalid range */ }
    const m = new Map(days.map((d) => [format(d, "yyyy-MM-dd"), { day: format(d, "EEE dd/MM"), Collected: 0, Failed: 0 }]));
    for (const r of rows) {
      const e = m.get(r.Date);
      if (!e) continue;
      if (r._st === "collected") e.Collected++;
      if (r._st === "failed") e.Failed++;
    }
    return [...m.values()];
  }, [rows, from, to]);

  const leaders = useMemo(() => {
    const m = new Map<string, { driver: string; truck: string; total: number; collected: number; failed: number; times: Map<string, number[]> }>();
    for (const r of rows) {
      const e = m.get(r.Driver) ?? { driver: r.Driver, truck: r.Truck, total: 0, collected: 0, failed: 0, times: new Map() };
      e.total++;
      if (r._st === "collected") {
        e.collected++;
        if (r._collectedAt) e.times.set(r.Date, [...(e.times.get(r.Date) ?? []), new Date(r._collectedAt).getTime()]);
      }
      if (r._st === "failed") e.failed++;
      m.set(r.Driver, e);
    }
    return [...m.values()]
      .map((e) => {
        let gaps = 0, n = 0;
        for (const ts of e.times.values()) {
          ts.sort((a, b) => a - b);
          for (let i = 1; i < ts.length; i++) { gaps += ts[i]! - ts[i - 1]!; n++; }
        }
        return { ...e, rate: e.total ? Math.round((e.collected / e.total) * 100) : 0, avgMin: n ? Math.round(gaps / n / 60000) : null };
      })
      .sort((a, b) => b.rate - a.rate || b.collected - a.collected);
  }, [rows]);

  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r._st === "failed") {
      const k = r.Note && r.Note !== "-" ? r.Note.trim() : "No reason given";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
        <h2 className="font-display text-lg font-semibold">Daily collection rate</h2>
        <p className="mb-3 text-xs text-muted-foreground">Containers collected and failed per day</p>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={30} />
              <Tooltip {...tip} cursor={{ fill: "var(--accent)" }} />
              <Legend />
              <Bar dataKey="Collected" fill="var(--status-collected)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Failed" fill="var(--status-failed)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Driver leaderboard</h2>
        <p className="mb-3 text-xs text-muted-foreground">Ranked by completion rate · speed = average time between collections</p>
        {leaders.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
          <ol className="flex flex-col gap-2">
            {leaders.map((l, i) => (
              <li key={l.driver} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium"><span className="mr-2 text-muted-foreground">#{i + 1}</span>{l.driver} <span className="text-xs text-muted-foreground">· {l.truck}</span></span>
                  <span className="font-display text-lg font-bold">{l.rate}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[color:var(--status-collected)]" style={{ width: `${l.rate}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {l.collected}/{l.total} collected · {l.failed} failed · {l.avgMin !== null ? `${l.avgMin} min/container` : "speed n/a"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Failure reasons</h2>
        <p className="mb-3 text-xs text-muted-foreground">Most frequent reasons for failed collections</p>
        {reasons.length === 0 ? <p className="text-sm text-muted-foreground">No failed collections in this period.</p> : (
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={reasons} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {reasons.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
