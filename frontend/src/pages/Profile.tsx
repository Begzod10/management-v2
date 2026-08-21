import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, X, Check, User, Briefcase, Calendar, DollarSign, ShieldCheck, Wallet, TrendingDown, TrendingUp, Send, LinkIcon, Unlink, LogOut, Mail, AtSign, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ChangeEmailDialog } from "@/components/profile/ChangeEmailDialog";
import { ChangeUsernameDialog } from "@/components/profile/ChangeUsernameDialog";
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

interface TelegramStatus {
  linked: boolean;
  telegram_id?: number;
}

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
  date: string;
  payment_type: string;
}

const ROLES = [
  { value: "owner",      label: "Owner" },
  { value: "admin",      label: "Admin" },
  { value: "director",   label: "Direktor" },
  { value: "manager",    label: "Menejer" },
  { value: "employee",   label: "Xodim" },
  { value: "hr",         label: "HR" },
  { value: "accountant", label: "Buxgalter" },
  { value: "user",       label: "Foydalanuvchi" },
];

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salaryMonths, setSalaryMonths] = useState<SalaryMonth[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<SalaryMonth | null>(null);
  const [salaryDays, setSalaryDays] = useState<SalaryDay[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    surname: "",
    born_date: "",
    age: "",
    job_id: "",
    salary: "",
    role: "",
  });

  useEffect(() => {
    if (!user?.id) return;
    setSalaryLoading(true);
    apiFetch(`/salary-months/?user_id=${user.id}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: SalaryMonth[]) => {
        const list = Array.isArray(data) ? data.sort((a, b) => b.date.localeCompare(a.date)) : [];
        setSalaryMonths(list);
        if (list.length > 0) {
          setSelectedMonth(list[0]);
          return apiFetch(`/salary-days/?salary_month_id=${list[0].id}`)
            .then((r) => r.ok ? r.json() : [])
            .then((days) => setSalaryDays(Array.isArray(days) ? days : []));
        }
      })
      .catch(() => {})
      .finally(() => setSalaryLoading(false));
  }, [user?.id]);

  const handleMonthSelect = async (monthId: string) => {
    const month = salaryMonths.find((m) => String(m.id) === monthId) ?? null;
    setSelectedMonth(month);
    if (!month) { setSalaryDays([]); return; }
    try {
      const res = await apiFetch(`/salary-days/?salary_month_id=${month.id}`);
      if (res.ok) setSalaryDays(await res.json().then((d: unknown) => Array.isArray(d) ? d : []));
    } catch {}
  };

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      apiFetch(`/users/${user.id}`).then((r) => r.ok ? r.json() : null),
      apiFetch("/jobs/").then((r) => r.ok ? r.json() : []),
    ]).then(([profileData, jobsData]) => {
      if (profileData) {
        setProfile(profileData);
        setForm({
          name: profileData.name,
          surname: profileData.surname,
          born_date: profileData.born_date ?? "",
          age: String(profileData.age ?? ""),
          job_id: String(profileData.job_id ?? ""),
          salary: String(profileData.salary ?? ""),
          role: profileData.role ?? "",
        });
      }
      setJobs(Array.isArray(jobsData) ? jobsData : []);
    }).catch(() => {
      toast.error("Serverga ulanib bo'lmadi");
    }).finally(() => setLoading(false));
  }, [user?.id]);

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        surname: form.surname,
        is_active: profile.is_active,
      };

      const bornDate = form.born_date || profile.born_date;
      if (bornDate) body.born_date = bornDate;

      const age = Number(form.age) || profile.age;
      if (age) body.age = age;

      const jobId = Number(form.job_id) || profile.job_id;
      if (jobId) body.job_id = jobId;

      const salary = Number(form.salary) || profile.salary;
      if (salary) body.salary = salary;

      const roleToSave = form.role || profile.role;
      if (roleToSave) body.role = roleToSave;

      const res = await apiFetch(`/users/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Xatolik yuz berdi");
        return;
      }
      const updated: UserProfile = await res.json();
      setProfile(updated);
      setEditing(false);
      toast.success("Profil yangilandi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!profile) return;
    setForm({
      name: profile.name,
      surname: profile.surname,
      born_date: profile.born_date ?? "",
      age: String(profile.age ?? ""),
      job_id: String(profile.job_id ?? ""),
      salary: String(profile.salary ?? ""),
      role: profile.role ?? "",
    });
    setEditing(false);
  };

  useEffect(() => {
    setTelegramLoading(true);
    apiFetch("/telegram/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data: TelegramStatus | null) => { if (data) setTelegramStatus(data); })
      .catch(() => {})
      .finally(() => setTelegramLoading(false));
  }, []);

  const handleTelegramConnect = async () => {
    setTelegramConnecting(true);
    try {
      const res = await apiFetch("/telegram/generate-link-code", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Telegram ulanishda xatolik");
        return;
      }
      const data = await res.json();
      const deepLink: string = data.deep_link ?? "";
      if (!deepLink) {
        toast.error("Havola olinmadi");
        return;
      }
      const a = document.createElement("a");
      a.href = deepLink;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(data.instruction ?? "Telegram bot ochildi. Botda /start bosing.");
      // re-check status after a short delay
      setTimeout(() => {
        apiFetch("/telegram/status")
          .then((r) => r.ok ? r.json() : null)
          .then((d: TelegramStatus | null) => { if (d) setTelegramStatus(d); })
          .catch(() => {});
      }, 4000);
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setTelegramConnecting(false);
    }
  };

  const handleTelegramUnlink = async () => {
    setTelegramConnecting(true);
    try {
      const res = await apiFetch("/telegram/unlink", { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Ajratishda xatolik");
        return;
      }
      setTelegramStatus({ linked: false });
      toast.success("Telegram ajratildi");
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setTelegramConnecting(false);
    }
  };

  const jobName = (id: number) => jobs.find((j) => j.id === id)?.name ?? "—";
  const initials = profile ? `${profile.name[0]}${profile.surname[0]}`.toUpperCase() : "?";

  return (
    <DashboardLayout title="Profil">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !profile ? (
        <div className="text-center text-muted-foreground py-16">Profil topilmadi</div>
      ) : (
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {/* Header card */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarFallback className="text-base bg-primary text-primary-foreground font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold leading-tight truncate">{profile.name} {profile.surname}</h2>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {profile.role && (
                      <Badge variant="outline" className="capitalize text-xs">
                        <ShieldCheck className="h-3 w-3 mr-1" />{profile.role}
                      </Badge>
                    )}
                    <Badge variant={profile.is_active ? "default" : "secondary"} className="text-xs">
                      {profile.is_active ? "Faol" : "Nofaol"}
                    </Badge>
                    {profile.job_id && (
                      <Badge variant="secondary" className="text-xs">
                        <Briefcase className="h-3 w-3 mr-1" />{jobName(profile.job_id)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {telegramLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : telegramStatus?.linked ? (
                      <>
                        <Badge className="text-xs bg-green-500 hover:bg-green-500 gap-1">
                          <Send className="h-2.5 w-2.5" /> Ulangan
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={handleTelegramUnlink}
                          disabled={telegramConnecting}
                          title="Ajratish"
                        >
                          {telegramConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={handleTelegramConnect}
                        disabled={telegramConnecting}
                        className="h-7 text-xs bg-sky-500 hover:bg-sky-600 text-white"
                      >
                        {telegramConnecting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                        Telegram
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t">
                {!editing && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-8 text-xs flex-1">
                    <Pencil className="h-3 w-3 mr-1" /> Tahrirlash
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setPasswordDialogOpen(true)} className="h-8 text-xs flex-1">
                  <KeyRound className="h-3 w-3 mr-1" /> Parol
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}
                  className="h-8 text-xs flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-3 w-3 mr-1" /> Chiqish
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="finance" className="flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="finance" className="flex-1 gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Moliyaviy
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1 gap-1.5">
                <User className="h-3.5 w-3.5" /> Shaxsiy
              </TabsTrigger>
            </TabsList>

            {/* Finance tab */}
            <TabsContent value="finance" className="mt-3">
              <Card>
                <CardHeader className="pb-3 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-1">
                      <Wallet className="h-4 w-4" /> Moliyaviy ma'lumotlar
                    </CardTitle>
                    {salaryMonths.length > 1 && (
                      <Select value={selectedMonth ? String(selectedMonth.id) : ""} onValueChange={handleMonthSelect}>
                        <SelectTrigger className="w-36 h-8 text-xs shrink-0">
                          <SelectValue placeholder="Oy tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {salaryMonths.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.date}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {salaryLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !selectedMonth ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Maosh ma'lumotlari yo'q</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-muted/50 px-2 py-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-0.5">
                            <DollarSign className="h-3 w-3" /> Maosh
                          </p>
                          <p className="text-xs font-bold">{selectedMonth.salary.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 px-2 py-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-0.5">
                            <TrendingDown className="h-3 w-3 text-red-500" /> Berilgan
                          </p>
                          <p className="text-xs font-bold text-red-600">{selectedMonth.taken_salary.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 px-2 py-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground mb-1 flex items-center justify-center gap-0.5">
                            <TrendingUp className="h-3 w-3 text-green-500" /> Qolgan
                          </p>
                          <p className="text-xs font-bold text-green-600">{selectedMonth.remaining_salary.toLocaleString()}</p>
                        </div>
                      </div>
                      {selectedMonth.salary > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Berilgan ulush</span>
                            <span>{Math.round((selectedMonth.taken_salary / selectedMonth.salary) * 100)}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, Math.round((selectedMonth.taken_salary / selectedMonth.salary) * 100))}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {salaryDays.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">To'lovlar tarixi</p>
                          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {salaryDays.map((d) => (
                              <div key={d.id} className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-xs">{d.date}</span>
                                  <Badge variant="secondary" className="text-xs">{d.payment_type}</Badge>
                                </div>
                                <span className="font-mono font-semibold">{d.amount.toLocaleString()} so'm</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Info tab */}
            <TabsContent value="info" className="mt-3">
              <Card>
                <CardHeader className="pb-3 pt-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> Shaxsiy ma'lumotlar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Email / Username — always visible, regardless of Tahrirlash mode */}
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
                  </div>

                  {editing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Ism</Label>
                          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
                        </div>
                        <div>
                          <Label>Familiya</Label>
                          <Input value={form.surname} onChange={(e) => set("surname", e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label>Tug'ilgan sana</Label>
                        <Input type="date" value={form.born_date} onChange={(e) => set("born_date", e.target.value)} />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" onClick={handleCancel} disabled={saving}>
                          <X className="h-3.5 w-3.5 mr-1" /> Bekor qilish
                        </Button>
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
                      <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Tug'ilgan sana" value={profile.born_date || "—"} />
                      <Separator />
                      <InfoRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Lavozim" value={jobName(profile.job_id)} />
                      <Separator />
                      <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Maosh" value={profile.salary ? `${profile.salary.toLocaleString()} so'm` : "—"} />
                      <Separator />
                      <InfoRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Rol" value={
                        profile.role
                          ? <Badge variant="outline" className="capitalize text-xs">{profile.role}</Badge>
                          : "—"
                      } />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <ChangeEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            currentEmail={profile.email}
            onChanged={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          />
          <ChangeUsernameDialog
            open={usernameDialogOpen}
            onOpenChange={setUsernameDialogOpen}
            currentUsername={profile.username ?? ""}
            onChanged={(newUsername) => setProfile((p) => (p ? { ...p, username: newUsername } : p))}
          />
          <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} userId={profile.id} />
        </div>
      )}
    </DashboardLayout>
  );
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 px-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-right min-w-0 break-all">{value}</div>
    </div>
  );
}

export default ProfilePage;
