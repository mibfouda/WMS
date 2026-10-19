import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { deleteTemplate, fetchTemplates, migrateLegacy, runGenerator, updateTemplate, type RouteTemplate } from "@/lib/recurring";
import type { Driver } from "@/lib/wm";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useTemplates() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["recurring"], queryFn: fetchTemplates, retry: false });
  // Once per load: move old browser-saved routes into the table, then make sure today's tasks exist.
  useEffect(() => {
    if (!q.isSuccess) return;
    (async () => {
      try {
        await migrateLegacy();
        const n = await runGenerator();
        if (n) toast.success(`${n} recurring task${n > 1 ? "s" : ""} created for today`);
        qc.invalidateQueries({ queryKey: ["recurring"] });
        qc.invalidateQueries({ queryKey: ["tasks-all"] });
      } catch { /* generator also runs nightly on the database */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.isSuccess]);
  return q;
}

export function RecurringRoutesDialog({ open, onOpenChange, drivers }: { open: boolean; onOpenChange: (o: boolean) => void; drivers: Driver[] }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["recurring"], queryFn: fetchTemplates, retry: false });
  const list: RouteTemplate[] = q.data ?? [];
  const act = async (p: Promise<void>) => {
    try { await p; qc.invalidateQueries({ queryKey: ["recurring"] }); }
    catch (e) { toast.error("Could not save", { description: (e as Error).message }); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">Recurring routes</DialogTitle></DialogHeader>
        {q.isError && (
          <p className="text-sm text-destructive">
            The recurring routes table isn’t set up in your database yet. Run the setup script once, then reopen this window.
          </p>
        )}
        {q.isSuccess && list.length === 0 && <p className="text-sm text-muted-foreground">No recurring routes yet. Tick “Repeat this route” when sending tasks.</p>}
        <ul className="grid max-h-96 gap-2 overflow-y-auto">
          {list.map((t) => {
            const d = drivers.find((x) => x.driver_id === t.driver_id);
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="text-sm">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-muted-foreground">{d ? `${d.username} — ${d.truck_number}` : `Driver #${t.driver_id}`} · {t.bin_ids.length} stops</p>
                  <p className="text-muted-foreground">
                    {t.weekdays.length === 7 ? "Every day" : t.weekdays.map((w) => DAYS[w]).join(", ")} · from {t.start_date} {t.end_date ? `until ${t.end_date}` : "· forever"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={t.active} onCheckedChange={(v) => act(updateTemplate(t.id, { active: v }))} aria-label="Active" />
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => act(deleteTemplate(t.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
