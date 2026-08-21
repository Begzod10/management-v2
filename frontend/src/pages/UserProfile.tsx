import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canDo, staffReadOnly, canEditTarget, assignableRoles } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Pencil, X, Check, User, Briefcase, Calendar,
  DollarSign, ShieldCheck, ArrowLeft, Trash2, Wallet, Plus,
  ChevronDown, ChevronRight, TrendingDown, TrendingUp, Filter,
  Mail, AtSign, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { AdminChangeEmailDialog } from "@/components/profile/AdminChangeEmailDialog";
import { AdminChangeUsernameDialog } from "@/components/profile/AdminChangeUsernameDialog";
import { ChangePasswordDialog } from "@/components/profile/ChangePasswordDialog";

interface UserProfile {
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

interface SalaryMonth {
  id: number;
  salary: number;
  taken_salary: number;
  remaining_salary: number;
  user_id: number;
  date: string;
}

interface SalaryDay {
  id: number;
  salary_month_id: number;
  amount: number;
  user_id: number;
  date: string;
  payment_type: string;
}

const ROLES = [
  { value: "owner",        label: "Owner" },
  { value: "admin",        label: "Admin" },
  { value: "director",     label: "Direktor" },
  { value: "manager",      label: "Menejer" },
  { value: "employee",     label: "Xodim" },
  { value: "hr",           label: "HR" },
  { value: "accountant",   label: "Buxgalter" },
  { value: "spiritualist", label: "Spiritualist" },
  { value: "user",         label: "Foydalanuvchi" },
];

const PAYMENT_TYPES = ["naqd", "karta", "bank", "avans", "boshqa"];

const today = () => new Date().toISOString().slice(0, 10);

const UserProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const role = authUser?.role;

  const canEdit   = canDo(role, "staff_edit");
  const canDelete = canDo(role, "staff_delete");
  const canSalary = canDo(role, "salary_manage");
  const readOnly  = staffReadOnly(role);
  const isSelf    = String(authUser?.id) === id;
  const allowedRoles = assignableRoles(role);

  // ── Profile ────────────────────────────────────────────────────
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteProfile, setShowDeleteProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Privilege checks — depend on profile state
  const canEditThisUser   = canEdit   && !isSelf && canEditTarget(role, profile?.role);
  const canDeleteThisUser = canDelete && !isSelf && canEditTarget(role, profile?.role);

  const [form, setForm] = useState({
    name: "", surname: "", email: "", born_date: "",
    age: "", job_id: "", salary: "", role: "", is_active: true,
  });

  // ── Salary ─────────────────────────────────────────────────────
  const [salaryMonths, setSalaryMonths] = useState<SalaryMonth[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [days, setDays] = useState<Record<number, SalaryDay[]>>({});
  const [daysLoading, setDaysLoading] = useState<Record<number, boolean>>({});

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]     = useState("");
  const [filterMonth, setFilterMonth]       = useState("");
  const [filterYear, setFilterYear]         = useState("");
  const [filtersOpen, setFiltersOpen]       = useState(false);

  // Month dialog
  const [monthDialog, setMonthDialog] = useState(false);
  const [editingMonth, setEditingMonth] = useState<SalaryMonth | null>(null);
  const [monthForm, setMonthForm] = useState({ salary: "", date: today() });
  const [savingMonth, setSavingMonth] = useState(false);

  // Day dialog
  const [dayDialog, setDayDialog] = useState(false);
  const [editingDay, setEditingDay] = useState<SalaryDay | null>(null);
  const [dayMonthId, setDayMonthId] = useState<number | null>(null);
  const [dayForm, setDayForm] = useState({ amount: "", date: today(), payment_type: "naqd" });
  const [savingDay, setSavingDay] = useState(false);

  // Delete
  const [deleteMonth, setDeleteMonth] = useState<SalaryMonth | null>(null);
  const [deleteDay, setDeleteDay] = useState<{ day: SalaryDay; monthId: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load profile ───────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/users/${id}`).then((r) => r.ok ? r.json() : null),
      apiFetch("/jobs/").then((r) => r.ok ? r.json() : []),
    ]).then(([data, jobsData]) => {
      if (!data) { toast.error("Foydalanuvchi topilmadi"); navigate("/staff"); return; }
      setProfile(data);
      setForm({
        name: data.name, surname: data.surname, email: data.email,
        born_date: data.born_date ?? "", age: String(data.age ?? ""),
        job_id: String(data.job_id ?? ""), salary: String(data.salary ?? ""),
        role: data.role ?? "", is_active: data.is_active ?? true,
      });
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    }).catch(() => toast.error("Serverga ulanib bo'lmadi"))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Load salary months ─────────────────────────────────────────
  const loadSalaryMonths = async () => {
    if (!id) return;
    setSalaryLoading(true);
    try {
      const params = new URLSearchParams({ user_id: id });
      if (filterDateFrom) params.set("date_from", filterDateFrom);
      if (filterDateTo)   params.set("date_to", filterDateTo);
      if (filterMonth)    params.set("month", filterMonth);
      if (filterYear)     params.set("year", filterYear);
      const res = await apiFetch(`/salary-months/?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSalaryMonths(Array.isArray(data) ? data.sort((a: SalaryMonth, b: SalaryMonth) => b.date.localeCompare(a.date)) : []);
      }
    } catch {} finally { setSalaryLoading(false); }
  };

  useEffect(() => { if (id) loadSalaryMonths(); }, [id]);

  const hasActiveFilters = !!(filterDateFrom || filterDateTo || filterMonth || filterYear);

  const applyFilters = () => loadSalaryMonths();
  const resetFilters = () => {
    setFilterDateFrom(""); setFilterDateTo(""); setFilterMonth(""); setFilterYear("");
    setTimeout(() => loadSalaryMonths(), 0);
  };

  // ── Expand days ────────────────────────────────────────────────
  const toggleMonth = async (monthId: number) => {
    if (expandedMonth === monthId) { setExpandedMonth(null); return; }
    setExpandedMonth(monthId);
    if (!days[monthId]) {
      setDaysLoading((p) => ({ ...p, [monthId]: true }));
      try {
        const res = await apiFetch(`/salary-days/?salary_month_id=${monthId}`);
        if (res.ok) {
          const data = await res.json();
          setDays((p) => ({ ...p, [monthId]: Array.isArray(data) ? data : [] }));
        }
      } catch {} finally { setDaysLoading((p) => ({ ...p, [monthId]: false })); }
    }
  };

  const reloadDays = async (monthId: number) => {
    const res = await apiFetch(`/salary-days/?salary_month_id=${monthId}`);
    if (res.ok) {
      const data = await res.json();
      setDays((p) => ({ ...p, [monthId]: Array.isArray(data) ? data : [] }));
    }
  };

  // ── Profile CRUD ───────────────────────────────────────────────
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name, surname: form.surname, email: form.email,
        is_active: form.is_active,
      };
      
      const bornDate = form.born_date || profile.born_date;
      if (bornDate) body.born_date = bornDate;
      
      const age = Number(form.age) || profile.age;
      if (age) body.age = age;

      if (!isSelf && (role === "owner" || role === "admin")) {
        if (form.job_id !== undefined && form.job_id !== "") body.job_id = Number(form.job_id);
        if (form.salary !== undefined && form.salary !== "") body.salary = Number(form.salary);
        if (form.role) body.role = form.role;
      }
      const res = await apiFetch(`/users/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.detail || "Xatolik"); return; }
      const updated: UserProfile = await res.json();
      setProfile(updated); setEditing(false); toast.success("Yangilandi");
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setSaving(false); }
  };

  const handleDeleteProfile = async () => {
    if (!profile) return;
    setDeletingProfile(true);
    try {
      const res = await apiFetch(`/users/${profile.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("Xodim o'chirildi"); navigate("/staff");
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setDeletingProfile(false); }
  };

  const handleCancel = () => {
    if (!profile) return;
    setForm({
      name: profile.name, surname: profile.surname, email: profile.email,
      born_date: profile.born_date ?? "", age: String(profile.age ?? ""),
      job_id: String(profile.job_id ?? ""), salary: String(profile.salary ?? ""),
      role: profile.role ?? "", is_active: profile.is_active ?? true,
    });
    setEditing(false);
  };

  // ── Salary Month CRUD ──────────────────────────────────────────
  const openCreateMonth = () => {
    setEditingMonth(null);
    setMonthForm({ salary: "", date: today() });
    setMonthDialog(true);
  };

  const openEditMonth = (m: SalaryMonth, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMonth(m);
    setMonthForm({ salary: String(m.salary), date: m.date });
    setMonthDialog(true);
  };

  const handleSaveMonth = async () => {
    if (!monthForm.salary || !profile) { toast.error("Maosh majburiy"); return; }
    setSavingMonth(true);
    try {
      const res = editingMonth
        ? await apiFetch(`/salary-months/${editingMonth.id}`, {
            method: "PATCH",
            body: JSON.stringify({ salary: Number(monthForm.salary) }),
          })
        : await apiFetch("/salary-months/", {
            method: "POST",
            body: JSON.stringify({ user_id: profile.id, salary: Number(monthForm.salary), date: monthForm.date }),
          });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editingMonth ? "Yangilandi" : "Yaratildi");
      setMonthDialog(false); loadSalaryMonths();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setSavingMonth(false); }
  };

  const handleDeleteMonth = async () => {
    if (!deleteMonth) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/salary-months/${deleteMonth.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi"); setDeleteMonth(null); loadSalaryMonths();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setDeleting(false); }
  };

  // ── Salary Day CRUD ────────────────────────────────────────────
  const openCreateDay = (monthId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDay(null); setDayMonthId(monthId);
    setDayForm({ amount: "", date: today(), payment_type: "naqd" });
    setDayDialog(true);
  };

  const openEditDay = (day: SalaryDay, monthId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDay(day); setDayMonthId(monthId);
    setDayForm({ amount: String(day.amount), date: day.date, payment_type: day.payment_type });
    setDayDialog(true);
  };

  const handleSaveDay = async () => {
    if (!dayForm.amount || !profile) { toast.error("Summa majburiy"); return; }
    setSavingDay(true);
    try {
      const res = editingDay
        ? await apiFetch(`/salary-days/${editingDay.id}`, {
            method: "PATCH",
            body: JSON.stringify({ amount: Number(dayForm.amount), payment_type: dayForm.payment_type }),
          })
        : await apiFetch("/salary-days/", {
            method: "POST",
            body: JSON.stringify({
              salary_month_id: dayMonthId, user_id: profile.id,
              amount: Number(dayForm.amount), date: dayForm.date, payment_type: dayForm.payment_type,
            }),
          });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editingDay ? "Yangilandi" : "Qo'shildi");
      setDayDialog(false);
      if (dayMonthId) { await reloadDays(dayMonthId); loadSalaryMonths(); }
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setSavingDay(false); }
  };

  const handleDeleteDay = async () => {
    if (!deleteDay) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/salary-days/${deleteDay.day.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      await reloadDays(deleteDay.monthId); loadSalaryMonths(); setDeleteDay(null);
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setDeleting(false); }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const jobName = (jobId: number) => jobs.find((j) => j.id === jobId)?.name ?? "—";
  const roleName = (val: string) => ROLES.find((r) => r.value === val)?.label ?? val;
  const initials = profile ? `${profile.name[0]}${profile.surname[0]}`.toUpperCase() : "?";

  return (
    <DashboardLayout
      title="Xodim profili"
      headerExtra={
        <Button variant="ghost" size="sm" onClick={() => navigate("/staff")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !profile ? null : (
        <div className="max-w-2xl mx-auto space-y-4">

          {/* ── Header card ── */}
          <Card>
            <CardContent className="pt-6 pb-0">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarFallback className="text-lg bg-primary text-primary-foreground font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{profile.name} {profile.surname}</h2>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile.role && (
                          <Badge variant="outline" className="text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />{roleName(profile.role)}
                          </Badge>
                        )}
                        <Badge variant={profile.is_active ? "default" : "secondary"} className="text-xs">
                          {profile.is_active ? "Faol" : "Nofaol"}
                        </Badge>
                        {profile.job_id ? (
                          <Badge variant="secondary" className="text-xs">
                            <Briefcase className="h-3 w-3 mr-1" />{jobName(profile.job_id)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {!readOnly && (canEditThisUser || canDeleteThisUser) && (
                      <div className="flex gap-2 shrink-0">
                        {canEditThisUser && !editing && (
                          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Tahrirlash
                          </Button>
                        )}
                        {canDeleteThisUser && (
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDeleteProfile(true)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> O'chirish
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs inside header card */}
              <Tabs defaultValue="info" className="mt-5">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
                  <TabsTrigger
                    value="info"
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    <User className="h-3.5 w-3.5 mr-1.5" /> Info
                  </TabsTrigger>
                  {canSalary && (
                    <TabsTrigger
                      value="salary"
                      className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      <Wallet className="h-3.5 w-3.5 mr-1.5" /> Salary
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* ── INFO TAB ── */}
                <TabsContent value="info" className="mt-0">
                  <div className="py-4">
                    {/* Email / Username / Password — always visible, only for those who can edit this employee */}
                    {canEditThisUser && (
                      <div className="space-y-0 mb-4 pb-4 border-b">
                        <InfoRow
                          icon={<Mail className="h-3.5 w-3.5" />}
                          label="Email"
                          value={
                            <div className="flex items-center gap-2 justify-end">
                              <span>{profile.email}</span>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setEmailDialogOpen(true)}>
                                O'zgartirish
                              </Button>
                            </div>
                          }
                        />
                        <Separator />
                        <InfoRow
                          icon={<AtSign className="h-3.5 w-3.5" />}
                          label="Username"
                          value={
                            <div className="flex items-center gap-2 justify-end">
                              <span>{profile.username || "—"}</span>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setUsernameDialogOpen(true)}>
                                O'zgartirish
                              </Button>
                            </div>
                          }
                        />
                        <Separator />
                        <InfoRow
                          icon={<KeyRound className="h-3.5 w-3.5" />}
                          label="Parol"
                          value={
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPasswordDialogOpen(true)}>
                              O'zgartirish
                            </Button>
                          }
                        />
                      </div>
                    )}
                    {editing ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Ism</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
                          <div><Label>Familiya</Label><Input value={form.surname} onChange={(e) => set("surname", e.target.value)} /></div>
                        </div>
                        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                        <div><Label>Tug'ilgan sana</Label><Input type="date" value={form.born_date} onChange={(e) => set("born_date", e.target.value)} /></div>
                        <div className="flex items-center gap-2 pb-1">
                          <Checkbox id="is_active_edit" checked={form.is_active} onCheckedChange={(v) => set("is_active", v === true)} />
                          <Label htmlFor="is_active_edit" className="cursor-pointer">Faol xodim</Label>
                        </div>
                        {!isSelf && (role === "owner" || role === "admin") && (
                          <>
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
                              <Label>Maosh (stavka)</Label>
                              <Input type="number" min="0" value={form.salary} onChange={(e) => set("salary", e.target.value)} />
                            </div>
                            <div>
                              <Label>Rol</Label>
                              <Select value={form.role} onValueChange={(v) => set("role", v)}>
                                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                                <SelectContent>
                                  {allowedRoles.map((r) => {
                                    const roleLabel = ROLES.find(x => x.value === r)?.label || r;
                                    return <SelectItem key={r} value={r}>{roleLabel}</SelectItem>;
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={handleCancel} disabled={saving}><X className="h-3.5 w-3.5 mr-1" /> Bekor</Button>
                          <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                            Saqlash
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        <InfoRow icon={<User className="h-3.5 w-3.5" />} label="To'liq ism" value={`${profile.name} ${profile.surname}`} />
                        <Separator />
                        {!canEditThisUser && (
                          <>
                            <InfoRow label="Email" value={profile.email} />
                            <Separator />
                            <InfoRow label="Username" value={profile.username || "—"} />
                            <Separator />
                          </>
                        )}
                        <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Tug'ilgan sana" value={profile.born_date || "—"} />
                        <Separator />
                        <InfoRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Lavozim" value={jobName(profile.job_id)} />
                        <Separator />
                        {canSalary && (
                          <>
                            <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Maosh (stavka)" value={profile.salary ? `${profile.salary.toLocaleString()} so'm` : "—"} />
                            <Separator />
                          </>
                        )}
                        <InfoRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Rol" value={
                          profile.role ? <Badge variant="outline" className="text-xs">{roleName(profile.role)}</Badge> : "—"
                        } />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── SALARY TAB ── */}
                <TabsContent value="salary" className="mt-0">
                  <div className="py-4 space-y-3">
                    {/* Filter toggle row */}
                    <div className="flex items-center justify-between">
                      <Button
                        size="sm" variant="outline"
                        className={`h-8 text-xs gap-1.5 ${hasActiveFilters ? "border-primary text-primary" : ""}`}
                        onClick={() => setFiltersOpen((v) => !v)}
                      >
                        <Filter className="h-3.5 w-3.5" />
                        Filters
                        {hasActiveFilters && (
                          <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {[filterDateFrom, filterDateTo, filterMonth, filterYear].filter(Boolean).length}
                          </span>
                        )}
                        {filtersOpen ? <ChevronDown className="h-3.5 w-3.5 ml-0.5" /> : <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
                      </Button>
                      {canSalary && (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={openCreateMonth}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Oylik qo'shish
                        </Button>
                      )}
                    </div>

                    {/* Collapsible filters */}
                    {filtersOpen && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Date from</Label>
                            <Input type="date" className="h-8 text-xs" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Date to</Label>
                            <Input type="date" className="h-8 text-xs" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Month (1–12)</Label>
                            <Input type="number" min={1} max={12} className="h-8 text-xs" placeholder="—" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Year</Label>
                            <Input type="number" min={2000} className="h-8 text-xs" placeholder="—" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={() => { applyFilters(); setFiltersOpen(false); }}>Apply</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { resetFilters(); setFiltersOpen(false); }}>Reset</Button>
                        </div>
                      </div>
                    )}

                    {/* Months list — max height + scroll */}
                    <div className="overflow-y-auto rounded-lg border divide-y max-h-[420px]">
                      {salaryLoading ? (
                        <div className="flex justify-center py-10">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : salaryMonths.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">Ma'lumot topilmadi</p>
                      ) : salaryMonths.map((m) => (
                        <div key={m.id}>
                          {/* Month row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                            onClick={() => toggleMonth(m.id)}
                          >
                            <div className="text-muted-foreground shrink-0">
                              {expandedMonth === m.id
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{m.date}</span>
                                <span className="text-xs text-muted-foreground">stavka: {m.salary.toLocaleString()}</span>
                              </div>
                              <div className="flex gap-4 mt-1">
                                <span className="text-xs flex items-center gap-1 text-muted-foreground">
                                  <TrendingDown className="h-3 w-3 text-red-500" />
                                  <span className="font-medium text-red-600">{m.taken_salary.toLocaleString()}</span>
                                </span>
                                <span className="text-xs flex items-center gap-1 text-muted-foreground">
                                  <TrendingUp className="h-3 w-3 text-green-500" />
                                  <span className="font-medium text-green-600">{m.remaining_salary.toLocaleString()}</span>
                                </span>
                              </div>
                              {m.salary > 0 && (
                                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden w-full max-w-[200px]">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${Math.min(100, Math.round((m.taken_salary / m.salary) * 100))}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            {canSalary && (
                              <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                {/* <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEditMonth(m, e)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button> */}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteMonth(m); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Expanded days */}
                          {expandedMonth === m.id && (
                            <div className="bg-muted/30 px-6 pb-3 pt-2 space-y-2 border-t">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To'lovlar</p>
                                {canSalary && (
                                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={(e) => openCreateDay(m.id, e)}>
                                    <Plus className="h-3 w-3 mr-1" /> Qo'shish
                                  </Button>
                                )}
                              </div>
                              {daysLoading[m.id] ? (
                                <div className="py-2 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                              ) : !days[m.id] || days[m.id].length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">To'lovlar yo'q</p>
                              ) : (
                                <div className="space-y-1">
                                  {days[m.id].map((d) => (
                                    <div key={d.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs">{d.date}</span>
                                        <Badge variant="secondary" className="text-xs">{d.payment_type}</Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-semibold text-sm">{d.amount.toLocaleString()} so'm</span>
                                        {canSalary && (
                                          <div className="flex gap-1">
                                            {/* <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => openEditDay(d, m.id, e)}>
                                              <Pencil className="h-3 w-3" />
                                            </Button> */}
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteDay({ day: d, monthId: m.id }); }}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Month dialog ── */}
      <Dialog open={monthDialog} onOpenChange={setMonthDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingMonth ? "Oylikni tahrirlash" : "Oylik qo'shish"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Maosh (stavka) <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} value={monthForm.salary}
                onChange={(e) => setMonthForm((p) => ({ ...p, salary: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Sana</Label>
              <Input type="date" value={monthForm.date}
                onChange={(e) => setMonthForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthDialog(false)} disabled={savingMonth}>Bekor</Button>
            <Button onClick={handleSaveMonth} disabled={savingMonth}>
              {savingMonth && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMonth ? "Saqlash" : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Day dialog ── */}
      <Dialog open={dayDialog} onOpenChange={setDayDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingDay ? "To'lovni tahrirlash" : "To'lov qo'shish"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Summa <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} value={dayForm.amount}
                onChange={(e) => setDayForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>To'lov turi</Label>
              <Select value={dayForm.payment_type} onValueChange={(v) => setDayForm((p) => ({ ...p, payment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sana</Label>
              <Input type="date" value={dayForm.date}
                onChange={(e) => setDayForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayDialog(false)} disabled={savingDay}>Bekor</Button>
            <Button onClick={handleSaveDay} disabled={savingDay}>
              {savingDay && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDay ? "Saqlash" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete month ── */}
      <AlertDialog open={!!deleteMonth}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>{deleteMonth?.date} oylik yozuvini o'chirish. Barcha to'lovlar ham o'chadi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteMonth(null)} disabled={deleting}>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMonth} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete day ── */}
      <AlertDialog open={!!deleteDay}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>{deleteDay?.day.date} — {deleteDay?.day.amount.toLocaleString()} so'm to'lovni o'chirish.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDay(null)} disabled={deleting}>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDay} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete profile ── */}
      <AlertDialog open={showDeleteProfile}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">"{profile?.name} {profile?.surname}"</span> xodimini o'chirish. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteProfile(false)} disabled={deletingProfile}>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfile} disabled={deletingProfile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {profile && (
        <>
          <AdminChangeEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            currentEmail={profile.email}
            userId={profile.id}
            onChanged={(newEmail) => setProfile((p) => (p ? { ...p, email: newEmail } : p))}
          />
          <AdminChangeUsernameDialog
            open={usernameDialogOpen}
            onOpenChange={setUsernameDialogOpen}
            currentUsername={profile.username ?? ""}
            userId={profile.id}
            onChanged={(newUsername) => setProfile((p) => (p ? { ...p, username: newUsername } : p))}
          />
          <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} userId={profile.id} />
        </>
      )}
    </DashboardLayout>
  );
};

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className="text-sm font-medium text-right">{value}</div>
    </div>
  );
}

export default UserProfilePage;
