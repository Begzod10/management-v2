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
  onChanged: () => void;
}

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ChangeEmailDialog({ open, onOpenChange, currentEmail, onChanged }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ newEmail?: string; password?: string }>({});
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewEmail("");
    setPassword("");
    setErrors({});
    setAvailability("idle");
  }, [open]);

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
      apiFetch(`/auth/check-email?email=${encodeURIComponent(trimmed)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { available?: boolean } | null) => {
          if (data) setAvailability(data.available ? "available" : "taken");
        })
        .catch(() => setAvailability("idle"));
    }, 500);
    return () => clearTimeout(t);
  }, [newEmail, currentEmail]);

  const validate = () => {
    const e: typeof errors = {};
    const trimmed = newEmail.trim();
    if (!trimmed) e.newEmail = "Yangi email kiritish majburiy";
    else if (!EMAIL_RE.test(trimmed)) e.newEmail = "Email noto'g'ri";
    if (!password) e.password = "Joriy parolni kiriting";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (availability === "taken") return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/auth/change-email", {
        method: "POST",
        body: JSON.stringify({ new_email: newEmail.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success(data.message || "Email o'zgartirildi. Qaytadan tizimga kiring.");
      onOpenChange(false);
      onChanged();
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
          <DialogDescription>
            Yangi email va joriy parolingizni kiriting. Tasdiqlangach qaytadan tizimga kirishingiz kerak bo'ladi.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Yangi email</Label>
            <div className="relative">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); if (errors.newEmail) setErrors((p) => ({ ...p, newEmail: undefined })); }}
                placeholder={currentEmail}
                className={errors.newEmail ? "border-destructive pr-8" : "pr-8"}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {availability === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {availability === "available" && <Check className="h-3.5 w-3.5 text-green-500" />}
                {availability === "taken" && <X className="h-3.5 w-3.5 text-destructive" />}
              </span>
            </div>
            {errors.newEmail ? (
              <p className="text-xs text-destructive">{errors.newEmail}</p>
            ) : availability === "taken" ? (
              <p className="text-xs text-destructive">Bu email allaqachon band</p>
            ) : availability === "available" ? (
              <p className="text-xs text-green-600">Bu email bo'sh</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label>Joriy parol</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
              placeholder="••••••••"
              className={errors.password ? "border-destructive" : ""}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
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
