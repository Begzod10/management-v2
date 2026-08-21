import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { useInstitution } from "@/contexts/InstitutionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronRight, Wallet, TrendingDown, TrendingUp, Filter,
} from "lucide-react";
import { toast } from "sonner";

// ─── Salary types ────────────────────────────────────────────────────────────

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

interface User { id: number; name: string; surname: string; }

// ─── Dividend / Investment types ──────────────────────────────────────────────

interface Dividend {
  id: number;
  amount: number;
  source: string;
  date: string;
  description: string;
  payment_type: string;
  location_id: number;
  branch_id: number;
  deleted: boolean;
  created_at: string;
}

interface Investment {
  id: number;
  amount: number;
  source: string;
  date: string;
  description: string;
  payment_type: string;
  location_id: number;
  branch_id: number;
  deleted: boolean;
  created_at: string;
}

interface Branch { id: number; name: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_TYPES = ["cash", "bank", "click", "transfer"];
const today = () => new Date().toISOString().slice(0, 10);

// ─── AccountingPage ───────────────────────────────────────────────────────────

const AccountingPage = () => {
  const { institution } = useInstitution();

  const [section, setSection] = useState<"salary" | "dividends" | "investments">("salary");

  // ── Salary state ────────────────────────────────────────────────────────────

  const [users, setUsers] = useState<User[]>([]);
  const [months, setMonths] = useState<SalaryMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser]         = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]     = useState("");
  const [filterMonth, setFilterMonth]       = useState("");
  const [filterYear, setFilterYear]         = useState("");
  const [filtersOpen, setFiltersOpen]       = useState(false);

  const [expanded, setExpanded]     = useState<Record<number, boolean>>({});
  const [days, setDays]             = useState<Record<number, SalaryDay[]>>({});
  const [daysLoading, setDaysLoading] = useState<Record<number, boolean>>({});

  const [monthDialog, setMonthDialog]   = useState(false);
  const [editingMonth, setEditingMonth] = useState<SalaryMonth | null>(null);
  const [monthForm, setMonthForm]       = useState({ user_id: "", salary: "", date: today() });
  const [savingMonth, setSavingMonth]   = useState(false);

  const [dayDialog, setDayDialog]   = useState(false);
  const [editingDay, setEditingDay] = useState<SalaryDay | null>(null);
  const [dayMonthId, setDayMonthId] = useState<number | null>(null);
  const [dayForm, setDayForm]       = useState({ amount: "", date: today(), payment_type: "cash" });
  const [savingDay, setSavingDay]   = useState(false);

  const [deleteMonth, setDeleteMonth] = useState<SalaryMonth | null>(null);
  const [deleteDay, setDeleteDay]     = useState<{ day: SalaryDay; monthId: number } | null>(null);
  const [deleting, setDeleting]       = useState(false);

  // ── Dividend state ──────────────────────────────────────────────────────────

  const [dividends, setDividends]             = useState<Dividend[]>([]);
  const [dividendsLoading, setDividendsLoading] = useState(false);
  const [divFilterMonth, setDivFilterMonth]   = useState("");
  const [divFilterYear, setDivFilterYear]     = useState("");
  const [divFiltersOpen, setDivFiltersOpen]   = useState(false);

  const [branches, setBranches]   = useState<Branch[]>([]);
  const [divDialog, setDivDialog] = useState(false);
  const [editingDiv, setEditingDiv] = useState<Dividend | null>(null);
  const [divForm, setDivForm]     = useState({
    amount: "", description: "", payment_type: "cash", date: today(), branch_id: "",
  });
  const [savingDiv, setSavingDiv]   = useState(false);
  const [deleteDiv, setDeleteDiv]   = useState<Dividend | null>(null);
  const [deletingDiv, setDeletingDiv] = useState(false);

  // ── Investment state ─────────────────────────────────────────────────────

  const [investments, setInvestments]               = useState<Investment[]>([]);
  const [investmentsLoading, setInvestmentsLoading] = useState(false);
  const [invFilterMonth, setInvFilterMonth]         = useState("");
  const [invFilterYear, setInvFilterYear]           = useState("");
  const [invFiltersOpen, setInvFiltersOpen]         = useState(false);

  const [invDialog, setInvDialog]       = useState(false);
  const [editingInv, setEditingInv]     = useState<Investment | null>(null);
  const [invForm, setInvForm]           = useState({
    amount: "", description: "", payment_type: "cash", date: today(), branch_id: "",
  });
  const [savingInv, setSavingInv]       = useState(false);
  const [deleteInv, setDeleteInv]       = useState<Investment | null>(null);
  const [deletingInv, setDeletingInv]   = useState(false);

  // ── Salary callbacks ────────────────────────────────────────────────────────

  const loadMonths = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser !== "all") params.set("user_id", filterUser);
      if (filterDateFrom) params.set("date_from", filterDateFrom);
      if (filterDateTo)   params.set("date_to", filterDateTo);
      if (filterMonth)    params.set("month", filterMonth);
      if (filterYear)     params.set("year", filterYear);
      const qs = params.toString() ? `?${params}` : "";
      const res = await apiFetch(`/salary-months/${qs}`);
      if (res.ok) setMonths(await res.json().then((d) => Array.isArray(d) ? d : []));
    } catch {} finally { setLoading(false); }
  }, [filterUser, filterDateFrom, filterDateTo, filterMonth, filterYear]);

  useEffect(() => {
    apiFetch("/users/").then((r) => r.ok ? r.json() : []).then((d) => setUsers(Array.isArray(d) ? d : []));
  }, []);

  useEffect(() => { loadMonths(); }, [loadMonths]);

  const toggleExpand = async (month: SalaryMonth) => {
    const open = !expanded[month.id];
    setExpanded((p) => ({ ...p, [month.id]: open }));
    if (open && !days[month.id]) {
      setDaysLoading((p) => ({ ...p, [month.id]: true }));
      try {
        const res = await apiFetch(`/salary-days/?salary_month_id=${month.id}`);
        if (res.ok) {
          const data = await res.json();
          setDays((p) => ({ ...p, [month.id]: Array.isArray(data) ? data : [] }));
        }
      } catch {} finally {
        setDaysLoading((p) => ({ ...p, [month.id]: false }));
      }
    }
  };

  const reloadDays = async (monthId: number) => {
    const res = await apiFetch(`/salary-days/?salary_month_id=${monthId}`);
    if (res.ok) {
      const data = await res.json();
      setDays((p) => ({ ...p, [monthId]: Array.isArray(data) ? data : [] }));
    }
  };

  const openCreateMonth = () => {
    setEditingMonth(null);
    setMonthForm({ user_id: "", salary: "", date: today() });
    setMonthDialog(true);
  };

  const handleSaveMonth = async () => {
    if (!monthForm.user_id || !monthForm.salary) {
      toast.error("Xodim va maosh majburiy");
      return;
    }
    setSavingMonth(true);
    try {
      const body = {
        user_id: Number(monthForm.user_id),
        salary: Number(monthForm.salary),
        date: monthForm.date || today(),
      };
      const res = editingMonth
        ? await apiFetch(`/salary-months/${editingMonth.id}`, { method: "PATCH", body: JSON.stringify({ salary: body.salary }) })
        : await apiFetch("/salary-months/", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editingMonth ? "Yangilandi" : "Yaratildi");
      setMonthDialog(false);
      loadMonths();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setSavingMonth(false); }
  };

  const handleDeleteMonth = async () => {
    if (!deleteMonth) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/salary-months/${deleteMonth.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      setDeleteMonth(null);
      loadMonths();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setDeleting(false); }
  };

  const openCreateDay = (monthId: number, userId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDay(null);
    setDayMonthId(monthId);
    setDayForm({ amount: "", date: today(), payment_type: "cash" });
    setDayDialog(true);
    (window as any).__dayUserId = userId;
  };

  const handleSaveDay = async () => {
    if (!dayForm.amount) { toast.error("Summa majburiy"); return; }
    setSavingDay(true);
    try {
      let res: Response;
      if (editingDay) {
        res = await apiFetch(`/salary-days/${editingDay.id}`, {
          method: "PATCH",
          body: JSON.stringify({ amount: Number(dayForm.amount), payment_type: dayForm.payment_type }),
        });
      } else {
        res = await apiFetch("/salary-days/", {
          method: "POST",
          body: JSON.stringify({
            salary_month_id: dayMonthId,
            user_id: (window as any).__dayUserId,
            amount: Number(dayForm.amount),
            date: dayForm.date || today(),
            payment_type: dayForm.payment_type,
          }),
        });
      }
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editingDay ? "Yangilandi" : "Yaratildi");
      setDayDialog(false);
      if (dayMonthId) {
        await reloadDays(dayMonthId);
        loadMonths();
      }
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setSavingDay(false); }
  };

  const handleDeleteDay = async () => {
    if (!deleteDay) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/salary-days/${deleteDay.day.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      await reloadDays(deleteDay.monthId);
      loadMonths();
      setDeleteDay(null);
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setDeleting(false); }
  };

  const userName = (id: number) => {
    const u = users.find((u) => u.id === id);
    return u ? `${u.name} ${u.surname}` : `#${id}`;
  };

  const hasActiveFilters = !!(filterUser !== "all" || filterDateFrom || filterDateTo || filterMonth || filterYear);
  const activeFilterCount = [filterUser !== "all", filterDateFrom, filterDateTo, filterMonth, filterYear].filter(Boolean).length;

  const resetFilters = () => {
    setFilterUser("all");
    setFilterDateFrom(""); setFilterDateTo(""); setFilterMonth(""); setFilterYear("");
  };

  const totalSalary = months.reduce((s, m) => s + (m.salary || 0), 0);
  const totalTaken  = months.reduce((s, m) => s + (m.taken_salary || 0), 0);
  const totalLeft   = months.reduce((s, m) => s + (m.remaining_salary || 0), 0);

  // ── Dividend callbacks ──────────────────────────────────────────────────────

  const loadDividends = useCallback(async () => {
    setDividendsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("source", institution);
      if (divFilterMonth) params.set("month", divFilterMonth);
      if (divFilterYear)  params.set("year", divFilterYear);
      const res = await apiFetch(`/dividends?${params}`);
      if (res.ok) setDividends(await res.json().then((d) => Array.isArray(d) ? d : []));
    } catch {} finally { setDividendsLoading(false); }
  }, [institution, divFilterMonth, divFilterYear]);

  useEffect(() => {
    if (section === "dividends") loadDividends();
  }, [section, loadDividends]);

  // Fetch branches/locations when dividends section opens
  useEffect(() => {
    if (section !== "dividends") return;
    apiFetch(`/${institution}/branches`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [section, institution]);

  const openCreateDiv = () => {
    setEditingDiv(null);
    setDivForm({ amount: "", description: "", payment_type: "cash", date: today(), branch_id: "" });
    setDivDialog(true);
  };

  const openEditDiv = (div: Dividend) => {
    setEditingDiv(div);
    const bid = institution === "gennis" ? String(div.location_id) : String(div.branch_id);
    setDivForm({
      amount: String(div.amount),
      description: div.description,
      payment_type: div.payment_type,
      date: div.date,
      branch_id: bid,
    });
    setDivDialog(true);
  };

  const handleSaveDiv = async () => {
    if (!divForm.amount) { toast.error("Summa majburiy"); return; }
    if (!divForm.branch_id) { toast.error("Filial majburiy"); return; }
    setSavingDiv(true);
    try {
      const locationKey = institution === "gennis" ? "location_id" : "branch_id";
      const body: Record<string, unknown> = {
        amount: Number(divForm.amount),
        description: divForm.description,
        payment_type: divForm.payment_type,
        source: institution,
        [locationKey]: divForm.branch_id ? Number(divForm.branch_id) : 0,
      };
      const res = editingDiv
        ? await apiFetch(`/dividends/${editingDiv.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/dividends", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editingDiv ? "Yangilandi" : "Yaratildi");
      setDivDialog(false);
      loadDividends();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setSavingDiv(false); }
  };

  const handleDeleteDiv = async () => {
    if (!deleteDiv) return;
    setDeletingDiv(true);
    try {
      const res = await apiFetch(`/dividends/${deleteDiv.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      setDeleteDiv(null);
      loadDividends();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setDeletingDiv(false); }
  };

  const totalDivAmount = dividends.reduce((s, d) => s + (d.amount || 0), 0);

  const branchName = (div: Dividend | Investment) => {
    const id = institution === "gennis" ? div.location_id : div.branch_id;
    const b = branches.find((b) => b.id === id);
    return b ? b.name : id ? `#${id}` : "—";
  };

  // ── Investment callbacks ─────────────────────────────────────────────────────

  const loadInvestments = useCallback(async () => {
    setInvestmentsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("source", institution);
      if (invFilterMonth) params.set("month", invFilterMonth);
      if (invFilterYear)  params.set("year", invFilterYear);
      const res = await apiFetch(`/investments?${params}`);
      if (res.ok) setInvestments(await res.json().then((d) => Array.isArray(d) ? d : []));
    } catch {} finally { setInvestmentsLoading(false); }
  }, [institution, invFilterMonth, invFilterYear]);

  useEffect(() => {
    if (section === "investments") loadInvestments();
  }, [section, loadInvestments]);

  useEffect(() => {
    if (section !== "investments") return;
    apiFetch(`/${institution}/branches`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [section, institution]);

  const openCreateInv = () => {
    setEditingInv(null);
    setInvForm({ amount: "", description: "", payment_type: "cash", date: today(), branch_id: "" });
    setInvDialog(true);
  };

  const openEditInv = (inv: Investment) => {
    setEditingInv(inv);
    const bid = institution === "gennis" ? String(inv.location_id) : String(inv.branch_id);
    setInvForm({
      amount: String(inv.amount),
      description: inv.description,
      payment_type: inv.payment_type,
      date: inv.date,
      branch_id: bid,
    });
    setInvDialog(true);
  };

  const handleSaveInv = async () => {
    if (!invForm.amount) { toast.error("Summa majburiy"); return; }
    if (!invForm.branch_id) { toast.error("Filial majburiy"); return; }
    setSavingInv(true);
    try {
      const locationKey = institution === "gennis" ? "location_id" : "branch_id";
      const body: Record<string, unknown> = {
        amount: Number(invForm.amount),
        description: invForm.description,
        payment_type: invForm.payment_type,
        date: invForm.date,
        source: institution,
        [locationKey]: invForm.branch_id ? Number(invForm.branch_id) : 0,
      };
      const res = editingInv
        ? await apiFetch(`/investments/${editingInv.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/investments", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { toast.error("Xatolik yuz berdi"); return; }
      toast.success(editingInv ? "Yangilandi" : "Yaratildi");
      setInvDialog(false);
      loadInvestments();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setSavingInv(false); }
  };

  const handleDeleteInv = async () => {
    if (!deleteInv) return;
    setDeletingInv(true);
    try {
      const res = await apiFetch(`/investments/${deleteInv.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("O'chirib bo'lmadi"); return; }
      toast.success("O'chirildi");
      setDeleteInv(null);
      loadInvestments();
    } catch { toast.error("Serverga ulanib bo'lmadi"); } finally { setDeletingInv(false); }
  };

  const totalInvAmount = investments.reduce((s, i) => s + (i.amount || 0), 0);

  // ── Header action ───────────────────────────────────────────────────────────

  const headerAction = section === "salary"
    ? <Button size="sm" onClick={openCreateMonth}><Plus className="h-4 w-4 mr-1" /> Oylik qo'shish</Button>
    : section === "dividends"
    ? <Button size="sm" onClick={openCreateDiv}><Plus className="h-4 w-4 mr-1" /> Dividend qo'shish</Button>
    : <Button size="sm" onClick={openCreateInv}><Plus className="h-4 w-4 mr-1" /> Investitsiya qo'shish</Button>;

  return (
    <DashboardLayout
      title="Moliya"
      headerExtra={
        <div className="flex items-center gap-2">
          <Select value={section} onValueChange={(v) => setSection(v as "salary" | "dividends" | "investments")}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="salary">Maosh</SelectItem>
              <SelectItem value="dividends">Dividendlar</SelectItem>
              <SelectItem value="investments">Investitsiyalar</SelectItem>
            </SelectContent>
          </Select>
          {headerAction}
        </div>
      }
    >
      {/* ── SALARY SECTION ──────────────────────────────────────────────────── */}
      {section === "salary" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Wallet className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jami maosh</p>
                    <p className="text-lg font-bold">{totalSalary.toLocaleString()} so'm</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10"><TrendingDown className="h-5 w-5 text-red-500" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Berilgan</p>
                    <p className="text-lg font-bold">{totalTaken.toLocaleString()} so'm</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10"><TrendingUp className="h-5 w-5 text-green-500" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Qolgan</p>
                    <p className="text-lg font-bold">{totalLeft.toLocaleString()} so'm</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Button
              size="sm" variant="outline"
              className={`h-8 text-sm gap-1.5 ${hasActiveFilters ? "border-primary text-primary" : ""}`}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
              {filtersOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>

            {filtersOpen && (
              <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <Label className="text-xs">Employee</Label>
                    <Select value={filterUser} onValueChange={setFilterUser}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name} {u.surname}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                  <Button size="sm" className="h-7 text-xs" onClick={() => { loadMonths(); setFiltersOpen(false); }}>Apply</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { resetFilters(); setFiltersOpen(false); }}>Reset</Button>
                </div>
              </div>
            )}
          </div>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Oylik maoshlar</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-muted whitespace-nowrap">Xodim</TableHead>
                    <TableHead className="whitespace-nowrap">Sana</TableHead>
                    <TableHead className="whitespace-nowrap">Maosh</TableHead>
                    <TableHead className="whitespace-nowrap">Berilgan</TableHead>
                    <TableHead className="whitespace-nowrap">Qolgan</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : months.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Ma'lumot yo'q</TableCell>
                    </TableRow>
                  ) : months.map((m) => (
                    <>
                      <TableRow
                        key={m.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpand(m)}
                      >
                        <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {expanded[m.id]
                              ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                            }
                            {userName(m.user_id)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{m.date}</TableCell>
                        <TableCell className="font-mono whitespace-nowrap">{m.salary.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-red-600 whitespace-nowrap">{m.taken_salary.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-green-600 whitespace-nowrap">{m.remaining_salary.toLocaleString()}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteMonth(m); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {expanded[m.id] && (
                        <TableRow key={`exp-${m.id}`}>
                          <TableCell colSpan={6} className="p-0 bg-muted/30">
                            <div className="px-4 py-3 space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To'lovlar</p>
                              {daysLoading[m.id] ? (
                                <div className="py-4 flex justify-center">
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : !days[m.id] || days[m.id].length === 0 ? (
                                <div className="space-y-2 py-1">
                                  <p className="text-xs text-muted-foreground">To'lovlar yo'q</p>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => openCreateDay(m.id, m.user_id, e)}>
                                    <Plus className="h-3 w-3 mr-1" /> To'lov qo'shish
                                  </Button>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {days[m.id].map((d) => (
                                    <div key={d.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 text-sm">
                                      <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground">{d.date}</span>
                                        <Badge variant="secondary" className="text-xs">{d.payment_type}</Badge>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono font-semibold">{d.amount.toLocaleString()} so'm</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteDay({ day: d, monthId: m.id }); }}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="outline" className="h-7 text-xs mt-1" onClick={(e) => openCreateDay(m.id, m.user_id, e)}>
                                    <Plus className="h-3 w-3 mr-1" /> To'lov qo'shish
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ── DIVIDENDS SECTION ───────────────────────────────────────────────── */}
      {section === "dividends" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Wallet className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jami dividendlar</p>
                    <p className="text-lg font-bold">{totalDivAmount.toLocaleString()} so'm</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Button
              size="sm" variant="outline"
              className={`h-8 text-sm gap-1.5 ${(divFilterMonth || divFilterYear) ? "border-primary text-primary" : ""}`}
              onClick={() => setDivFiltersOpen((v) => !v)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {(divFilterMonth || divFilterYear) && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {[divFilterMonth, divFilterYear].filter(Boolean).length}
                </span>
              )}
              {divFiltersOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>

            {divFiltersOpen && (
              <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Month (1–12)</Label>
                    <Input type="number" min={1} max={12} className="h-8 text-xs" placeholder="—" value={divFilterMonth} onChange={(e) => setDivFilterMonth(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Year</Label>
                    <Input type="number" min={2000} className="h-8 text-xs" placeholder="—" value={divFilterYear} onChange={(e) => setDivFilterYear(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => { loadDividends(); setDivFiltersOpen(false); }}>Apply</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDivFilterMonth(""); setDivFilterYear(""); setDivFiltersOpen(false); }}>Reset</Button>
                </div>
              </div>
            )}
          </div>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Dividendlar</CardTitle>
            </CardHeader>
            <div className="rounded-b-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead>To'lov turi</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dividendsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : dividends.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Ma'lumot yo'q</TableCell>
                    </TableRow>
                  ) : dividends.map((div) => (
                    <TableRow key={div.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditDiv(div)}>
                      <TableCell className="text-sm">{div.date}</TableCell>
                      <TableCell className="text-sm">{branchName(div)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{div.description || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{div.payment_type}</Badge></TableCell>
                      <TableCell className="font-mono font-semibold">{div.amount.toLocaleString()} so'm</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteDiv(div); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ── INVESTMENTS SECTION ─────────────────────────────────────────────── */}
      {section === "investments" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Wallet className="h-5 w-5 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Jami investitsiyalar</p>
                    <p className="text-lg font-bold">{totalInvAmount.toLocaleString()} so'm</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Button
              size="sm" variant="outline"
              className={`h-8 text-sm gap-1.5 ${(invFilterMonth || invFilterYear) ? "border-primary text-primary" : ""}`}
              onClick={() => setInvFiltersOpen((v) => !v)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {(invFilterMonth || invFilterYear) && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {[invFilterMonth, invFilterYear].filter(Boolean).length}
                </span>
              )}
              {invFiltersOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>

            {invFiltersOpen && (
              <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Month (1–12)</Label>
                    <Input type="number" min={1} max={12} className="h-8 text-xs" placeholder="—" value={invFilterMonth} onChange={(e) => setInvFilterMonth(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Year</Label>
                    <Input type="number" min={2000} className="h-8 text-xs" placeholder="—" value={invFilterYear} onChange={(e) => setInvFilterYear(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => { loadInvestments(); setInvFiltersOpen(false); }}>Apply</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setInvFilterMonth(""); setInvFilterYear(""); setInvFiltersOpen(false); }}>Reset</Button>
                </div>
              </div>
            )}
          </div>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Investitsiyalar</CardTitle>
            </CardHeader>
            <div className="rounded-b-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead>To'lov turi</TableHead>
                    <TableHead>Summa</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investmentsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : investments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Ma'lumot yo'q</TableCell>
                    </TableRow>
                  ) : investments.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEditInv(inv)}>
                      <TableCell className="text-sm">{inv.date}</TableCell>
                      <TableCell className="text-sm">{branchName(inv)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.description || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{inv.payment_type}</Badge></TableCell>
                      <TableCell className="font-mono font-semibold">{inv.amount.toLocaleString()} so'm</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteInv(inv); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ── INVESTMENT DIALOGS ───────────────────────────────────────────────── */}

      <Dialog open={invDialog} onOpenChange={setInvDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingInv ? "Investitsiyani tahrirlash" : "Investitsiya qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Summa <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} value={invForm.amount} onChange={(e) => setInvForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Filial <span className="text-destructive">*</span></Label>
              <Select value={invForm.branch_id} onValueChange={(v) => setInvForm((p) => ({ ...p, branch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To'lov turi</Label>
              <Select value={invForm.payment_type} onValueChange={(v) => setInvForm((p) => ({ ...p, payment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Izoh</Label>
              <Input value={invForm.description} onChange={(e) => setInvForm((p) => ({ ...p, description: e.target.value }))} placeholder="..." />
            </div>
            <div>
              <Label>Sana</Label>
              <Input type="date" value={invForm.date} onChange={(e) => setInvForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvDialog(false)} disabled={savingInv}>Bekor</Button>
            <Button onClick={handleSaveInv} disabled={savingInv}>
              {savingInv && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingInv ? "Saqlash" : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteInv}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteInv?.date} — {deleteInv?.amount.toLocaleString()} so'm investitsiyani o'chirish. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteInv(null)} disabled={deletingInv}>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInv} disabled={deletingInv} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingInv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── SALARY DIALOGS ──────────────────────────────────────────────────── */}

      <Dialog open={monthDialog} onOpenChange={setMonthDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingMonth ? "Oylikni tahrirlash" : "Oylik qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editingMonth && (
              <div>
                <Label>Xodim <span className="text-destructive">*</span></Label>
                <Select value={monthForm.user_id} onValueChange={(v) => setMonthForm((p) => ({ ...p, user_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name} {u.surname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Maosh <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} value={monthForm.salary} onChange={(e) => setMonthForm((p) => ({ ...p, salary: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Sana</Label>
              <Input type="date" value={monthForm.date} onChange={(e) => setMonthForm((p) => ({ ...p, date: e.target.value }))} />
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

      <Dialog open={dayDialog} onOpenChange={setDayDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingDay ? "To'lovni tahrirlash" : "To'lov qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Summa <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} value={dayForm.amount} onChange={(e) => setDayForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>To'lov turi</Label>
              <Select value={dayForm.payment_type} onValueChange={(v) => setDayForm((p) => ({ ...p, payment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sana</Label>
              <Input type="date" value={dayForm.date} onChange={(e) => setDayForm((p) => ({ ...p, date: e.target.value }))} />
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

      <AlertDialog open={!!deleteMonth}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMonth?.date} — {userName(deleteMonth?.user_id ?? 0)} oylik yozuvini o'chirish. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteMonth(null)} disabled={deleting}>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMonth} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDay}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlang</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDay?.day.date} — {deleteDay?.day.amount.toLocaleString()} so'm to'lovni o'chirish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDay(null)} disabled={deleting}>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDay} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── DIVIDEND DIALOGS ─────────────────────────────────────────────────── */}

      <Dialog open={divDialog} onOpenChange={setDivDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingDiv ? "Dividendni tahrirlash" : "Dividend qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Summa <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} value={divForm.amount} onChange={(e) => setDivForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Filial <span className="text-destructive">*</span></Label>
              <Select value={divForm.branch_id} onValueChange={(v) => setDivForm((p) => ({ ...p, branch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To'lov turi</Label>
              <Select value={divForm.payment_type} onValueChange={(v) => setDivForm((p) => ({ ...p, payment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Izoh</Label>
              <Input value={divForm.description} onChange={(e) => setDivForm((p) => ({ ...p, description: e.target.value }))} placeholder="..." />
            </div>
            <div>
              <Label>Sana</Label>
              <Input type="date" value={divForm.date} onChange={(e) => setDivForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDivDialog(false)} disabled={savingDiv}>Bekor</Button>
            <Button onClick={handleSaveDiv} disabled={savingDiv}>
              {savingDiv && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDiv ? "Saqlash" : "Yaratish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDiv}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>O'chirishni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDiv?.date} — {deleteDiv?.amount.toLocaleString()} so'm dividendni o'chirish. Bu amalni qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDiv(null)} disabled={deletingDiv}>Bekor</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDiv} disabled={deletingDiv} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingDiv && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AccountingPage;
