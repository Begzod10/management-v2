import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  userId: number;
  onChanged: (newEmail: string) => void;
}

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminChangeEmailDialog({ open, onOpenChange, currentEmail, userId, onChanged }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewEmail(currentEmail);
    setError(undefined);
    setAvailability("idle");
  }, [open, currentEmail]);

  useEffect(() => {
    const trimmed = newEmail.trim();
    if (!trimmed || trimmed === currentEmail) {
      setAvailability("idle");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const t = setTimeout(() => {
      apiFetch(`/users/${userId}/check-email?email=${encodeURIComponent(trimmed)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { available?: boolean } | null) => {
          if (data) setAvailability(data.available ? "available" : "taken");
        })
        .catch(() => setAvailability("idle"));
    }, 500);
    return () => clearTimeout(t);
  }, [newEmail, currentEmail, userId]);

  const validate = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) { setError("Yangi email kiritish majburiy"); return false; }
    if (!EMAIL_RE.test(trimmed)) { setError("Email noto'g'ri"); return false; }
    setError(undefined);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (availability === "taken") return;
    const trimmed = newEmail.trim();
    setSubmitting(true);
    try {
      const res = await apiFetch(`/users/${userId}/email`, {
        method: "PATCH",
        body: JSON.stringify({ new_email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success(data.message || "Email o'zgartirildi");
      onOpenChange(false);
      onChanged(trimmed);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emailni o'zgartirish</DialogTitle>
          <DialogDescription>Yangi emailni kiriting.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5 py-2">
          <Label>Yangi email</Label>
          <div className="relative">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); if (error) setError(undefined); }}
              className={error ? "border-destructive pr-8" : "pr-8"}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {availability === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {availability === "available" && <Check className="h-3.5 w-3.5 text-green-500" />}
              {availability === "taken" && <X className="h-3.5 w-3.5 text-destructive" />}
            </span>
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : availability === "taken" ? (
            <p className="text-xs text-destructive">Bu email allaqachon band</p>
          ) : availability === "available" ? (
            <p className="text-xs text-green-600">Bu email bo'sh</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Bekor qilish</Button>
          <Button onClick={handleSubmit} disabled={submitting || availability === "checking"}>
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
