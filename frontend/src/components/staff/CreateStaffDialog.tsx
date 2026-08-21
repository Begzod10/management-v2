import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { departments, getRoleSuggestions, type StaffMember, type AccessLevel } from "@/data/staffData";
import type { Branch } from "@/data/mockData";
import type { Institution } from "@/contexts/InstitutionContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  editMember: StaffMember | null;
  institution: Institution;
  onSave: (member: StaffMember) => void;
}

interface FormErrors {
  fullName?: string;
  departmentId?: string;
  role?: string;
}

export function CreateStaffDialog({ open, onOpenChange, branches, editMember, institution, onSave }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("all");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [status, setStatus] = useState(true);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const roleSuggestions = useMemo(() => (departmentId ? getRoleSuggestions(departmentId) : []), [departmentId]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editMember) {
      setFullName(editMember.fullName);
      setPhone(editMember.phone);
      setEmail(editMember.email);
      setDepartmentId(editMember.departmentId);
      setRole(editMember.role);
      setAccessLevel(editMember.accessLevel);
      setSelectedBranches(editMember.branchIds);
      setStatus(editMember.status === "active");
      setNotes(editMember.notes);
    } else {
      setFullName(""); setPhone(""); setEmail(""); setDepartmentId(""); setRole("");
      setAccessLevel("all"); setSelectedBranches([]); setStatus(true); setNotes("");
    }
  }, [editMember, open]);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!fullName.trim()) e.fullName = "To'liq ism majburiy";
    if (!departmentId) e.departmentId = "Bo'limni tanlang";
    if (!role.trim()) e.role = "Lavozimni kiriting";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const member: StaffMember = {
      id: editMember?.id ?? `s-${Date.now()}`,
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      departmentId,
      role: role.trim(),
      accessLevel,
      branchIds: accessLevel === "all" ? [] : selectedBranches,
      status: status ? "active" : "inactive",
      notes: notes.trim(),
      createdAt: editMember?.createdAt ?? new Date().toISOString().slice(0, 10),
      lastLogin: editMember?.lastLogin ?? "—",
      institution,
    };

    onSave(member);
    toast.success(editMember ? "Xodim yangilandi" : "Xodim qo'shildi");
    onOpenChange(false);
  };

  const toggleBranch = (id: string) => {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMember ? "Xodimni tahrirlash" : "Xodim qo'shish"}</DialogTitle>
          <DialogDescription>Xodim haqida ma'lumot to'ldiring</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>To'liq ism <span className="text-destructive">*</span></Label>
            <Input
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined })); }}
              placeholder="Ism Familiya"
              className={errors.fullName ? "border-destructive" : ""}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 XX XXX XX XX" />
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Bo'lim <span className="text-destructive">*</span></Label>
              <Select
                value={departmentId || undefined}
                onValueChange={(v) => { setDepartmentId(v); setRole(""); if (errors.departmentId) setErrors((p) => ({ ...p, departmentId: undefined })); }}
              >
                <SelectTrigger className={errors.departmentId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.departmentId && <p className="text-xs text-destructive">{errors.departmentId}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Lavozim <span className="text-destructive">*</span></Label>
              {roleSuggestions.length > 0 ? (
                <Select
                  value={role || undefined}
                  onValueChange={(v) => { setRole(v); if (errors.role) setErrors((p) => ({ ...p, role: undefined })); }}
                >
                  <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleSuggestions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={role}
                  onChange={(e) => { setRole(e.target.value); if (errors.role) setErrors((p) => ({ ...p, role: undefined })); }}
                  placeholder="Avval bo'limni tanlang"
                  className={errors.role ? "border-destructive" : ""}
                />
              )}
              {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Kirish darajasi</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="access" checked={accessLevel === "all"} onChange={() => setAccessLevel("all")} className="accent-[hsl(var(--primary))]" />
                Barcha filiallar
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="access" checked={accessLevel === "specific"} onChange={() => setAccessLevel("specific")} className="accent-[hsl(var(--primary))]" />
                Muayyan filiallar
              </label>
            </div>
            {accessLevel === "specific" && (
              <div className="grid gap-2 mt-1 pl-1">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selectedBranches.includes(b.id)} onCheckedChange={() => toggleBranch(b.id)} />
                    {b.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label>Holat</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{status ? "Faol" : "Nofaol"}</span>
              <Switch checked={status} onCheckedChange={setStatus} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Izohlar</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qo'shimcha ma'lumot..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button onClick={handleSubmit}>{editMember ? "Saqlash" : "Qo'shish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
