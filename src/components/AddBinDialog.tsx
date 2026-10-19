import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addBin } from "@/lib/wm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddBinDialog({
  point,
  open,
  onOpenChange,
  onDone,
}: {
  point: { lat: number; lng: number } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (point && open) {
      setCode("");
      setAddress("");
      setLat(point.lat.toFixed(6));
      setLng(point.lng.toFixed(6));
    }
  }, [point, open]);

  const submit = async () => {
    
    const la = Number(lat);
    const lo = Number(lng);
    if (!code.trim()) {
      toast.error("Container code is required.");
      return;
    }
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
      toast.error("Please enter valid latitude and longitude values.");
      return;
    }
    setSaving(true);
    try {
      await addBin({
        bin_code: code.trim(),
        address_description: address.trim() || null,
        latitude: la,
        longitude: lo,
      });
      toast.success(`Container ${code.trim()} added.`);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add container.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add container</DialogTitle>
          <DialogDescription>Position was taken from your map click. Enter the code and address.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="new-bin-code">Container code</Label>
            <Input id="new-bin-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-bin-address">Address / description</Label>
            <Input id="new-bin-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="new-bin-lat">Latitude</Label>
              <Input id="new-bin-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-bin-lng">Longitude</Label>
              <Input id="new-bin-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Add container"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
