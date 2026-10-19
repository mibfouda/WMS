import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createTask, type Bin, type Driver } from "@/lib/wm";
import { insertTemplate } from "@/lib/recurring";
import { useQueryClient } from "@tanstack/react-query";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AssignTaskDialog({
  open,
  onOpenChange,
  bins,
  drivers,
  binId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bins: Bin[];
  drivers: Driver[];
  binId?: number | undefined;
  onDone: () => void;
}) {
  const [driver, setDriver] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const [repeat, setRepeat] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [forever, setForever] = useState(true);
  const [until, setUntil] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(new Set(binId ? [binId] : []));
      setSearch("");
    }
  }, [open, binId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return bins;
    return bins.filter(
      (b) =>
        b.bin_code.toLowerCase().includes(s) ||
        (b.address_description ?? "").toLowerCase().includes(s),
    );
  }, [bins, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.bin_id));

  const toggle = (id: number, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAllFiltered = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const b of filtered) {
        if (on) next.add(b.bin_id);
        else next.delete(b.bin_id);
      }
      return next;
    });

  const submit = async () => {
    if (!driver || selected.size === 0) {
      toast.error("Choose a driver and at least one container");
      return;
    }
    if (repeat && (days.size === 0 || (!forever && (!until || until < date)))) {
      toast.error("Pick repeat days and a valid end date");
      return;
    }
    setBusy(true);
    try {
      // One task per container, ordered along the route.
      const ids = [...selected];
      for (let i = 0; i < ids.length; i++) {
        await createTask({ driver_id: +driver, bin_id: ids[i]!, task_date: date, route_order: i + 1 });
      }
      if (repeat) {
        try {
          await insertTemplate({
            name: name.trim() || `Route ${format(new Date(), "MMM d")}`,
            driver_id: +driver,
            bin_ids: ids,
            weekdays: [...days].sort(),
            start_date: date,
            end_date: forever ? null : until,
            active: true,
          });
          qc.invalidateQueries({ queryKey: ["recurring"] });
        } catch (e) {
          toast.error("Tasks sent, but the repeat could not be saved", { description: (e as Error).message });
        }
      }
      toast.success(`${ids.length} task${ids.length > 1 ? "s" : ""} sent to driver${repeat ? " · route will repeat" : ""}`);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error("Could not send task", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Send collection tasks</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Driver</Label>
            <Select value={driver} onValueChange={setDriver}>
              <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>
                {drivers.filter((d) => d.is_active).map((d) => (
                  <SelectItem key={d.driver_id} value={String(d.driver_id)}>
                    {d.username} — {d.truck_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Containers ({selected.size} selected)</Label>
            <Input
              placeholder="Search by code or address keyword…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Checkbox
                id="select-all"
                checked={allFilteredSelected}
                onCheckedChange={(v) => toggleAllFiltered(!!v)}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select all {search ? `matching “${search}”` : "containers"} ({filtered.length})
              </label>
            </div>
            <div className="max-h-48 overflow-y-auto grid gap-1 pr-1">
              {filtered.map((b) => (
                <div key={b.bin_id} className="flex items-center gap-2">
                  <Checkbox
                    id={`bin-${b.bin_id}`}
                    checked={selected.has(b.bin_id)}
                    onCheckedChange={(v) => toggle(b.bin_id, !!v)}
                  />
                  <label htmlFor={`bin-${b.bin_id}`} className="text-sm cursor-pointer">
                    {b.bin_code}
                    {b.address_description && b.address_description !== "na"
                      ? ` · ${b.address_description}`
                      : ""}
                  </label>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No containers match this keyword.</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{repeat ? "Start date" : "Date"}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Checkbox id="repeat" checked={repeat} onCheckedChange={(v) => setRepeat(!!v)} />
              <label htmlFor="repeat" className="text-sm font-medium cursor-pointer">Repeat this route automatically</label>
            </div>
            {repeat && (
              <>
                <Input placeholder="Route name (e.g. Al Ghala morning)" value={name} onChange={(e) => setName(e.target.value)} />
                <div className="flex flex-wrap gap-1">
                  {DAYS.map((d, i) => (
                    <Button key={d} type="button" size="sm" variant={days.has(i) ? "default" : "outline"}
                      onClick={() => setDays((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })}>
                      {d}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="forever" checked={forever} onCheckedChange={(v) => setForever(!!v)} />
                  <label htmlFor="forever" className="text-sm cursor-pointer">Forever</label>
                  {!forever && <Input type="date" className="ml-auto w-44" value={until} onChange={(e) => setUntil(e.target.value)} aria-label="Until" />}
                </div>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Sending…" : `Send ${selected.size || ""} task${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
