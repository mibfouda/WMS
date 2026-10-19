import { useEffect, useState } from "react";
import { toast } from "sonner";
import { updateBin, type Bin } from "@/lib/wm";
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

export function EditBinDialog({
  bin,
  open,
  onOpenChange,
  onDone,
}: {
  bin: Bin | null;
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
    if (bin && open) {
      setCode(bin.bin_code);
      setAddress(bin.address_description ?? "");
      setLat(String(bin.latitude));
      setLng(String(bin.longitude));
    }
  }, [bin, open]);

  const submit = async () => {
    if (!bin) return;
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
      await updateBin(bin.bin_id, {
        bin_code: code.trim(),
        address_description: address.trim() || null,
        latitude: la,
        longitude: lo,
      });
      toast.success(`Container ${code.trim()} updated.`);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update container.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit container</DialogTitle>
          <DialogDescription>Update the container's code, address and map position.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="bin-code">Container code</Label>
            <Input id="bin-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bin-address">Address / description</Label>
            <Input id="bin-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bin-lat">Latitude</Label>
              <Input id="bin-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bin-lng">Longitude</Label>
              <Input id="bin-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
