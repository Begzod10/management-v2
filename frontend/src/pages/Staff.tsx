import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff, UserX, Check, X, Copy, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { canDo, staffReadOnly } from "@/lib/permissions";

interface User {
  id: number;
  name: string;
  surname: string;
  email: string;
  username?: string;
  born_date: string;
  age: number;
  job_id: number;
  salary: number;
  role: string;
  is_active: boolean;
}

interface Job { id: number; name: string; }

const LIMIT = 200; // backend caps at 200 (Query(..., le=200) in list_staff_users) — was 50,
// which meant paging through 5 near-empty screens for 227 staff. 200 fits nearly
// everyone on one page and lets the table block actually fill the available height.

// ─── Pagination (offset-based, matches SchoolTeachers.tsx's own local copy) ───
function Pagination({
  count, offset, onOffsetChange,
}: {
  count: number; offset: number; onOffsetChange: (o: number) => void;
}) {
  const totalPages = Math.ceil(count / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-3 shrink-0 text-sm text-muted-foreground">
      <span>{offset + 1}–{Math.min(offset + LIMIT, count)} / {count}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={currentPage === 1} onClick={() => onOffsetChange(offset - LIMIT)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 py-1 border rounded-md bg-muted text-xs font-medium">
          {currentPage} / {totalPages}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={currentPage === totalPages} onClick={() => onOffsetChange(offset + LIMIT)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "director", label: "Direktor" },
  { value: "manager", label: "Menejer" },
  { value: "employee", label: "Xodim" },
  { value: "hr", label: "HR" },
  { value: "accountant", label: "Buxgalter" },
  { value: "spiritualist", label: "Spiritualist" },
  { value: "user", label: "Foydalanuvchi" },
  { value: "volunteer", label: "Volontyor" },
];

const defaultVolunteerForm = {
  name: "",
  surname: "",
  email: "",
  born_date: "",
  password: "12345678",
};

const defaultForm = {
  name: "",
  surname: "",
  email: "",
  username: "",
  born_date: "",
  password: "12345678",
  age: "" as string,
  job_id: "" as string,
  salary: "" as string,
  role: "user" as string,
  is_active: true as boolean,
};

const StaffPage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const role = authUser?.role;
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [staffOffset, setStaffOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof defaultForm, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");

  // Volunteer state — its own tab, own pagination, fetched from the same
  // paginated endpoint with role=volunteer.
  const [volunteerUsers, setVolunteerUsers] = useState<User[]>([]);
  const [volCount, setVolCount] = useState(0);
  const [volOffset, setVolOffset] = useState(0);
  const [volLoading, setVolLoading] = useState(true);
  const [volDialogOpen, setVolDialogOpen] = useState(false);
  const [volForm, setVolForm] = useState({ ...defaultVolunteerForm });
  const [volSaving, setVolSaving] = useState(false);
  const [volErrors, setVolErrors] = useState<Partial<Record<keyof typeof defaultVolunteerForm, string>>>({});
  const [volShowPassword, setVolShowPassword] = useState(false);
  const [volDeleteTarget, setVolDeleteTarget] = useState<User | null>(null);
  const [volDeleting, setVolDeleting] = useState(false);

  const loadJobs = async () => {
    try {
      const res = await apiFetch("/jobs/");
      if (res.ok) setJobs(await res.json().then((d) => Array.isArray(d) ? d : []));
    } catch { }
  };

  // Debounce search, otherwise every keystroke re-fetches.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setStaffOffset(0) }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadStaff = async (deleted: boolean, offset: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ deleted: String(deleted), offset: String(offset), limit: String(LIMIT) });
      if (q) params.set("search", q);
      const res = await apiFetch(`/users/staff?${params}`);
      if (res.ok) {
        const json = await res.json();
        setStaffUsers(json.results ?? []);
        setStaffCount(json.count ?? 0);
      }
    } catch { }
    finally { setLoading(false); }
  };

  const loadVolunteers = async (deleted: boolean, offset: number) => {
    setVolLoading(true);
    try {
      const params = new URLSearchParams({ deleted: String(deleted), role: "volunteer", offset: String(offset), limit: String(LIMIT) });
      const res = await apiFetch(`/users/staff?${params}`);
      if (res.ok) {
        const json = await res.json();
        setVolunteerUsers(json.results ?? []);
        setVolCount(json.count ?? 0);
      }
    } catch { }
    finally { setVolLoading(false); }
  };

  // loadData(deleted) is kept as the shared refresh point after
  // create/edit/delete — reloads whichever tab is showing at its current
  // page rather than resetting both back to page 1.
  const loadData = (deleted = showDeleted) => {
    loadStaff(deleted, staffOffset, debouncedSearch);
    loadVolunteers(deleted, volOffset);
  };

  useEffect(() => { loadStaff(showDeleted, staffOffset, debouncedSearch); }, [showDeleted, staffOffset, debouncedSearch]);
  useEffect(() => { loadVolunteers(showDeleted, volOffset); }, [showDeleted, volOffset]);
  useEffect(() => { loadJobs(); }, []);

  useEffect(() => {
    if (!dialogOpen) { setUsernameAvailability("idle"); return; }
    const trimmed = form.username.trim();
    if (!trimmed || trimmed === (editing?.username ?? "")) {
      setUsernameAvailability("idle");
      return;
    }
    if (!/^[a-zA-Z0-9_.]{3,100}$/.test(trimmed)) {
      setUsernameAvailability("idle");
      return;
    }
    setUsernameAvailability("checking");
    const t = setTimeout(() => {
      const path = editing
        ? `/users/${editing.id}/check-username?username=${encodeURIComponent(trimmed)}`
        : `/auth/check-username?username=${encodeURIComponent(trimmed)}`;
      apiFetch(path)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { available?: boolean } | null) => {
          if (data) setUsernameAvailability(data.available ? "available" : "taken");
        })
        .catch(() => setUsernameAvailability("idle"));
    }, 500);
    return () => clearTimeout(t);
  }, [form.username, dialogOpen, editing]);

  const set = <K extends keyof typeof defaultForm>(k: K, v: (typeof defaultForm)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Partial<Record<keyof typeof defaultForm, string>> = {};
    if (!form.name.trim()) e.name = "Majburiy";
    if (!form.surname.trim()) e.surname = "Majburiy";
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) e.email = "Noto'g'ri email";
    if (form.username.trim() && !/^[a-zA-Z0-9_.]{3,100}$/.test(form.username.trim())) {
      e.username = "3-100 belgi: harf, raqam, _ yoki .";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      name: user.name,
      surname: user.surname,
      email: user.email,
      username: user.username ?? "",
      born_date: user.born_date,
      password: "",
      age: String(user.age),
      job_id: String(user.job_id),
      salary: String(user.salary ?? ""),
      role: user.role ?? "",
      is_active: user.is_active ?? true,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (usernameAvailability === "taken") { toast.error("Bu username allaqachon band"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        surname: form.surname,
      };

      if (form.email.trim()) body.email = form.email.trim();

      const bornDate = form.born_date || (!editing ? new Date().toISOString().slice(0, 10) : "");
      if (bornDate) body.born_date = bornDate;

      const age = Number(form.age);
      if (age) body.age = age;

      const jobId = Number(form.job_id);
      if (jobId) body.job_id = jobId;

      const salary = Number(form.salary);
      if (salary) body.salary = salary;

      const roleToSave = form.role;
      if (roleToSave) body.role = roleToSave;
      else if (!editing) body.role = "user";

      if (!editing) {
        body.password = form.password || "12345678";
      } else {
        body.is_active = form.is_active;
      }

      const res = editing
        ? await apiFetch(`/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/users/", { method: "POST", body: JSON.stringify(body) });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }

      const saved: User = await res.json();
      const newUsername = form.username.trim();
      if (newUsername && newUsername !== (editing?.username ?? "")) {
        const usernameRes = await apiFetch(`/users/${saved.id}/username`, {
          method: "PATCH",
          body: JSON.stringify({ new_username: newUsername }),
        });
        if (!usernameRes.ok) {
          const err = await usernameRes.json().catch(() => ({}));
          toast.error(err.detail || "Username saqlanmadi");
        }
      }

      toast.success(editing ? "Yangilandi" : "Yaratildi");
      setDialogOpen(false);
      loadData(showDeleted);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      setDeleteTarget(null);
      loadData(showDeleted);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  const jobName = (id: number) => jobs.find((j) => j.id === id)?.name ?? "—";
  const roleName = (value: string) => ROLES.find((r) => r.value === value)?.label ?? value;

  const handleCopyUsername = async (e: React.MouseEvent, username: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(username);
      toast.success("Username nusxalandi");
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };

  const setVol = <K extends keyof typeof defaultVolunteerForm>(k: K, v: (typeof defaultVolunteerForm)[K]) =>
    setVolForm((p) => ({ ...p, [k]: v }));

  const validateVol = () => {
    const e: Partial<Record<keyof typeof defaultVolunteerForm, string>> = {};
    if (!volForm.name.trim()) e.name = "Majburiy";
    if (!volForm.surname.trim()) e.surname = "Majburiy";
    if (!volForm.email.trim()) e.email = "Majburiy";
    else if (!/\S+@\S+\.\S+/.test(volForm.email)) e.email = "Noto'g'ri email";
    setVolErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSaveVolunteer = async () => {
    if (!validateVol()) return;
    setVolSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: volForm.name,
        surname: volForm.surname,
        email: volForm.email,
        role: "volunteer",
        password: volForm.password || "12345678",
      };

      const bornDate = volForm.born_date || new Date().toISOString().slice(0, 10);
      if (bornDate) body.born_date = bornDate;
      const res = await apiFetch("/users/", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }
      toast.success("Volontyor yaratildi");
      setVolDialogOpen(false);
      setVolForm({ ...defaultVolunteerForm });
      loadData(showDeleted);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setVolSaving(false);
    }
  };

  const handleDeleteVolunteer = async () => {
    if (!volDeleteTarget) return;
    setVolDeleting(true);
    try {
      const res = await apiFetch(`/users/${volDeleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      setVolDeleteTarget(null);
      loadData(showDeleted);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setVolDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Xodimlar">
      <Tabs defaultValue="staff" className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <TabsList>
            <TabsTrigger value="staff">Xodimlar</TabsTrigger>
            <TabsTrigger value="volunteers">Volontyorlar</TabsTrigger>
          </TabsList>
          <div>
            <TabsContent value="staff" className="mt-0">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Qidirish..."
                    className="h-9 w-48 pl-8"
                  />
                </div>
                <Button
                  size="sm"
                  variant={showDeleted ? "destructive" : "outline"}
                  onClick={() => { setShowDeleted((v) => !v); setStaffOffset(0); setVolOffset(0) }}
                >
                  <UserX className="h-4 w-4 mr-1" />
                  O'chirilganlar
                </Button>
                {canDo(role, "staff_create") && !showDeleted && (
                  <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Xodim qo'shish</Button>
                )}
              </div>
            </TabsContent>
            <TabsContent value="volunteers" className="mt-0">
              {canDo(role, "staff_create") && (
                <Button size="sm" onClick={() => { setVolForm({ ...defaultVolunteerForm }); setVolErrors({}); setVolDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Volontyor qo'shish
                </Button>
              )}
            </TabsContent>
          </div>
        </div>

        {/* ── STAFF TAB ── */}
        <TabsContent value="staff" className="mt-0 flex-1 min-h-0 flex flex-col">
          <div className="rounded-lg border bg-card flex-1 min-h-0 overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Ism</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Lavozim</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Maosh</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : staffUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Xodimlar yo'q</TableCell>
                  </TableRow>
                ) : staffUsers.map((u, i) => (
                  <TableRow
                    key={u.id}
                    className={`hover:bg-muted/50 ${showDeleted ? "opacity-60" : "cursor-pointer"}`}
                    onClick={() => !showDeleted && navigate(`/staff/${u.id}`)}
                  >
                    <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                    <TableCell>
                      <div className={`font-medium ${showDeleted ? "line-through text-muted-foreground" : ""}`}>{u.name} {u.surname}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      {u.username ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-mono">@{u.username}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyUsername(e, u.username!)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Nusxalash"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{jobName(u.job_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      {u.role && <Badge variant="outline" className="text-xs">{roleName(u.role)}</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {u.salary ? u.salary.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {showDeleted
                        ? <Badge variant="destructive" className="text-xs">O'chirilgan</Badge>
                        : <Badge variant={u.is_active ? "default" : "secondary"} className="text-xs">
                            {u.is_active ? "Faol" : "Nofaol"}
                          </Badge>
                      }
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        {!showDeleted && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => navigate(`/staff/${u.id}`)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDo(role, "staff_edit") && !showDeleted && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDo(role, "staff_delete") && !showDeleted && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
          <Pagination count={staffCount} offset={staffOffset} onOffsetChange={setStaffOffset} />
        </TabsContent>

        {/* ── VOLUNTEERS TAB ── */}
        <TabsContent value="volunteers" className="mt-0 flex-1 min-h-0 flex flex-col">
          <div className="rounded-lg border bg-card flex-1 min-h-0 overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Ism</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {volLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : volunteerUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Volontyorlar yo'q</TableCell>
                  </TableRow>
                ) : volunteerUsers.map((u, i) => (
                  <TableRow key={u.id} className="hover:bg-muted/50">
                    <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{u.name} {u.surname}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? "default" : "secondary"} className="text-xs">
                        {u.is_active ? "Faol" : "Nofaol"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canDo(role, "staff_delete") && (
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setVolDeleteTarget(u)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
          <Pagination count={volCount} offset={volOffset} onOffsetChange={setVolOffset} />
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Xodimni tahrirlash" : "Xodim qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ism <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ali" className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label>Familiya <span className="text-destructive">*</span></Label>
                <Input value={form.surname} onChange={(e) => set("surname", e.target.value)} placeholder="Valiyev" className={errors.surname ? "border-destructive" : ""} />
                {errors.surname && <p className="text-xs text-destructive mt-1">{errors.surname}</p>}
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="user@example.com" className={errors.email ? "border-destructive" : ""} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            <div>
              <Label>Username</Label>
              <div className="relative">
                <Input
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                  placeholder="username"
                  className={errors.username ? "border-destructive pr-8" : "pr-8"}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {usernameAvailability === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  {usernameAvailability === "available" && <Check className="h-3.5 w-3.5 text-green-500" />}
                  {usernameAvailability === "taken" && <X className="h-3.5 w-3.5 text-destructive" />}
                </span>
              </div>
              {errors.username ? (
                <p className="text-xs text-destructive mt-1">{errors.username}</p>
              ) : usernameAvailability === "taken" ? (
                <p className="text-xs text-destructive mt-1">Bu username allaqachon band</p>
              ) : usernameAvailability === "available" ? (
                <p className="text-xs text-green-600 mt-1">Bu username bo'sh</p>
              ) : null}
            </div>

            {!editing && (
              <div>
                <Label>Parol</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="Default: 12345678"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Bo'sh qoldirish mumkin — standart parol: 12345678</p>
              </div>
            )}

            <div>
              <Label>Tug'ilgan sana</Label>
              <Input type="date" value={form.born_date} onChange={(e) => set("born_date", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lavozim</Label>
                <Select value={form.job_id} onValueChange={(v) => set("job_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={String(j.id)}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Maosh</Label>
                <Input type="number" min={0} value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => set("role", v)}>
                  <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is_active"
                    checked={form.is_active}
                    onCheckedChange={(v) => set("is_active", v === true)}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">Faol xodim</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={saving || usernameAvailability === "checking"}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Saqlash" : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">"{deleteTarget?.name} {deleteTarget?.surname}"</span> xodimini o'chirish. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)} disabled={deleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Volunteer Create Dialog */}
      <Dialog open={volDialogOpen} onOpenChange={setVolDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Volontyor qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ism <span className="text-destructive">*</span></Label>
                <Input value={volForm.name} onChange={(e) => setVol("name", e.target.value)} placeholder="Ali" className={volErrors.name ? "border-destructive" : ""} />
                {volErrors.name && <p className="text-xs text-destructive mt-1">{volErrors.name}</p>}
              </div>
              <div>
                <Label>Familiya <span className="text-destructive">*</span></Label>
                <Input value={volForm.surname} onChange={(e) => setVol("surname", e.target.value)} placeholder="Valiyev" className={volErrors.surname ? "border-destructive" : ""} />
                {volErrors.surname && <p className="text-xs text-destructive mt-1">{volErrors.surname}</p>}
              </div>
            </div>
            <div>
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={volForm.email} onChange={(e) => setVol("email", e.target.value)} placeholder="user@example.com" className={volErrors.email ? "border-destructive" : ""} />
              {volErrors.email && <p className="text-xs text-destructive mt-1">{volErrors.email}</p>}
            </div>
            <div>
              <Label>Parol</Label>
              <div className="relative">
                <Input
                  type={volShowPassword ? "text" : "password"}
                  value={volForm.password}
                  onChange={(e) => setVol("password", e.target.value)}
                  placeholder="Default: 12345678"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setVolShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {volShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Bo'sh qoldirish mumkin — standart parol: 12345678</p>
            </div>
            <div>
              <Label>Tug'ilgan sana</Label>
              <Input type="date" value={volForm.born_date} onChange={(e) => setVol("born_date", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVolDialogOpen(false)} disabled={volSaving}>Bekor qilish</Button>
            <Button onClick={handleSaveVolunteer} disabled={volSaving}>
              {volSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Volunteer Delete Confirm */}
      <AlertDialog open={!!volDeleteTarget}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">"{volDeleteTarget?.name} {volDeleteTarget?.surname}"</span> volontyorini o'chirish. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVolDeleteTarget(null)} disabled={volDeleting}>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVolunteer} disabled={volDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {volDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default StaffPage;
