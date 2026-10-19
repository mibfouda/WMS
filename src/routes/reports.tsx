import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportCharts } from "@/components/ReportCharts";
import { fetchBins, fetchDrivers, fetchTasks, taskState } from "@/lib/wm";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Collection Reports — WasteOps Dashboard" },
      { name: "description", content: "Collection reports by driver, truck and date range with PDF and CSV export." },
      { property: "og:title", content: "Collection Reports — WasteOps Dashboard" },
      { property: "og:description", content: "How many containers were collected, by driver or truck, for any period." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reports,
});

function Reports() {
  const [from, setFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mode, setMode] = useState<"driver" | "truck">("driver");
  const [who, setWho] = useState("all");

  const bins = useQuery({ queryKey: ["bins"], queryFn: fetchBins });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: fetchDrivers });
  const tasks = useQuery({ queryKey: ["tasks", from, to], queryFn: () => fetchTasks(from, to) });

  const rows = useMemo(() => {
    const ds = drivers.data ?? [];
    return (tasks.data ?? [])
      .filter((t) => {
        if (who === "all") return true;
        const d = ds.find((x) => x.driver_id === t.driver_id);
        return mode === "driver" ? String(t.driver_id) === who : d?.truck_number === who;
      })
      .map((t) => {
        const d = ds.find((x) => x.driver_id === t.driver_id);
        const b = bins.data?.find((x) => x.bin_id === t.bin_id);
        return {
          Date: t.task_date,
          Driver: d?.username ?? String(t.driver_id),
          Truck: d?.truck_number ?? "-",
          Container: b?.bin_code ?? `#${t.bin_id}`,
          Location: b?.address_description && b.address_description !== "na" ? b.address_description : "-",
          Status: t.status,
          "Collected at": t.collected_at ? format(new Date(t.collected_at), "yyyy-MM-dd HH:mm") : "-",
          Scan: t.scan_type ?? "-",
          Note: t.fail_reason ?? "-",
          _st: taskState(t.status),
          _collectedAt: t.collected_at,
        };
      });
  }, [tasks.data, drivers.data, bins.data, who, mode]);

  const collected = rows.filter((r) => r._st === "collected");
  const uniqueBins = new Set(collected.map((r) => r.Container)).size;
  const failed = rows.filter((r) => r._st === "failed").length;
  const pending = rows.filter((r) => r._st === "pending").length;
  const trucks = [...new Set((drivers.data ?? []).map((d) => d.truck_number))];
  const cols = ["Date", "Driver", "Truck", "Container", "Location", "Status", "Collected at", "Scan", "Note"] as const;
  const subject = who === "all" ? "All" : mode === "driver" ? drivers.data?.find((d) => String(d.driver_id) === who)?.username : who;
  const fileBase = `collection-report_${from}_${to}`;

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(String(r[c]))).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
    a.download = `${fileBase}.csv`;
    a.click();
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18);
    doc.text("Waste Collection Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`Period: ${from} to ${to}   |   ${mode === "driver" ? "Driver" : "Truck"}: ${subject}`, 14, 26);
    doc.text(`Containers collected: ${collected.length} (${uniqueBins} unique)   Failed: ${failed}   Pending: ${pending}   Total tasks: ${rows.length}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [cols as unknown as string[]],
      body: rows.map((r) => cols.map((c) => String(r[c]))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 101, 52] },
    });
    doc.save(`${fileBase}.pdf`);
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Collection reports</h1>
        <p className="text-sm text-muted-foreground">Filter by driver or truck and a date range.</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-[160px_1fr_1fr_1fr_auto]">
        <div className="grid gap-2">
          <Label>Report by</Label>
          <Select value={mode} onValueChange={(v) => { setMode(v as "driver" | "truck"); setWho("all"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="driver">Driver</SelectItem><SelectItem value="truck">Truck</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{mode === "driver" ? "Driver" : "Truck"}</Label>
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {mode === "driver"
                ? drivers.data?.map((d) => <SelectItem key={d.driver_id} value={String(d.driver_id)}>{d.username}</SelectItem>)
                : trucks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="grid gap-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><FileText className="h-4 w-4" /> CSV</Button>
          <Button onClick={exportPdf} disabled={!rows.length}><FileDown className="h-4 w-4" /> PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Containers collected" value={collected.length} sub={`${uniqueBins} unique containers`} accent />
        <Kpi label="Failed" value={failed} />
        <Kpi label="Pending" value={pending} />
        <Kpi label="Total tasks" value={rows.length} />
      </div>

      <ReportCharts rows={rows} from={from} to={to} />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {tasks.isLoading && <TableRow><TableCell colSpan={cols.length} className="text-muted-foreground">Loading…</TableCell></TableRow>}
            {!tasks.isLoading && !rows.length && <TableRow><TableCell colSpan={cols.length} className="text-muted-foreground">No tasks in this period.</TableCell></TableRow>}
            {rows.map((r, i) => (
              <TableRow key={i}>
                {cols.map((c) => (
                  <TableCell key={c}>{c === "Status" ? <span className={`status-pill status-${r._st}`}>{r.Status}</span> : r[c]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-4xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
