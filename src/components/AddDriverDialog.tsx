import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { addDriver } from "@/lib/wm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddDriverDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [truck, setTruck] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const name = username.trim();
    const truckNo = truck.trim();
    if (!name || !truckNo) {
      toast.error("Please enter the driver name and truck number.");
      return;
    }
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters.");
      return;
    }
    setSaving(true);
    try {
      await addDriver({ username: name, truck_number: truckNo, password_hash: password });
      toast.success(`Driver ${name} (truck ${truckNo}) added.`);
      setOpen(false);
      setUsername("");
      setTruck("");
      setPassword("");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add driver.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Add Driver
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new driver &amp; truck</DialogTitle>
          <DialogDescription>
            The driver becomes active immediately and can receive tasks from the map.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="driver-name">Driver name</Label>
            <Input
              id="driver-name"
              placeholder="e.g. Ahmed Hassan"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="truck-number">Truck number</Label>
            <Input
              id="truck-number"
              placeholder="e.g. TRK-07"
              value={truck}
              onChange={(e) => setTruck(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="driver-password">Password (for the driver app login)</Label>
            <Input id="driver-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Adding…" : "Add Driver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
