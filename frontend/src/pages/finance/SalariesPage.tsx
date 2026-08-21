import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MonthPicker } from "@/components/dashboard/MonthPicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useInstitution } from "@/contexts/InstitutionContext";
import { Loader2, ArrowLeft } from "lucide-react";

interface Branch { id: number; name: string; }

// ── Gennis ───────────────────────────────────────────────────────
interface GennisSalaryItem {
  id: number;
  teacher_name: string;
  teacher_salary: number;
  taken_money: number;
  remaining_salary: number;
  black_salary: number;
  debt: number;
  fine: number;
}
interface GennisSalariesData {
  salary_list: GennisSalaryItem[];
  total_salary: number;
  taken_money: number;
  remaining_salary: number;
  black_salary: number;
  debt: number;
  fine: number;
}

// ── Turon ────────────────────────────────────────────────────────
interface TuronSalaryItem {
  id: number;
  name: string;
  surname: string;
  phone: string;
  total_salary: number;
  taken_salary: number;
  remaining_salary: number;
  subject?: string; // teacher only
  cash: number;
  bank: number;
  click: number;
}
interface TuronSalariesData {
  salary: TuronSalaryItem[];
  branch: number;
}

type GennisSalaryType = "teacher" | "assistent" | "staff";
type TuronSalaryType  = "teacher" | "employer";

const GENNIS_TABS: { key: GennisSalaryType; label: string }[] = [
  { key: "teacher",   label: "O'qituvchilar" },
  { key: "assistent", label: "Asistentlar" },
  { key: "staff",     label: "Xodimlar" },
];
const TURON_TABS: { key: TuronSalaryType; label: string }[] = [
  { key: "teacher",  label: "O'qituvchilar" },
  { key: "employer", label: "Xodimlar" },
];

export default function SalariesPage() {
  const navigate = useNavigate();
  const { institution } = useInstitution();
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [to, setTo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`);
  const [fromYear, fromMonthStr] = from.split("-");
  const month = parseInt(fromMonthStr ?? "1") - 1;
  const year = parseInt(fromYear ?? String(now.getFullYear()));
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [gennisTab, setGennisTab] = useState<GennisSalaryType>("teacher");
  const [turonTab, setTuronTab]   = useState<TuronSalaryType>("teacher");
  const [gennisData, setGennisData] = useState<GennisSalariesData | null>(null);
  const [turonData, setTuronData]   = useState<TuronSalariesData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch(`/${institution}/branches`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: Branch[]) => {
        const list = Array.isArray(d) ? d : [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(String(list[0].id));
      })
      .catch(() => {});
  }, [institution]);

  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);
    setGennisData(null);
    setTuronData(null);

    if (institution === "turon") {
      const endpoint = turonTab === "teacher"
        ? `/turon/teacher-salaries?branch=${selectedBranch}&month=${month + 1}&year=${year}`
        : `/turon/employer-salaries?branch=${selectedBranch}&month=${month + 1}&year=${year}`;
      apiFetch(endpoint)
        .then((r) => r.ok ? r.json() : null)
        .then((res) => { if (res) setTuronData(res); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      apiFetch(`/gennis/salaries?location_id=${selectedBranch}&month=${month + 1}&year=${year}&type_salary=${gennisTab}`)
        .then((r) => r.ok ? r.json() : null)
        .then((res) => { if (res) setGennisData(res); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [institution, selectedBranch, month, year, gennisTab, turonTab]);

  // Stat cards
  const gennisCards = [
    { label: "Umumiy Oyliklar Summasi", value: gennisData?.total_salary ?? 0 },
    { label: "Umumiy Berilgan Oylik",   value: gennisData?.taken_money ?? 0,      colorClass: "text-primary" },
    { label: "Umumiy Qolgan Oylik",     value: gennisData?.remaining_salary ?? 0, colorClass: "text-amber-500" },
    { label: "Umumiy Qarzdorlik",       value: gennisData?.debt ?? 0,             colorClass: "text-destructive" },
    { label: "Black",                   value: gennisData?.black_salary ?? 0 },
    { label: "Umumiy Jariyma",          value: gennisData?.fine ?? 0,             colorClass: "text-destructive" },
  ];
  const turonTotalSalary    = (turonData?.salary ?? []).reduce((s, i) => s + i.total_salary, 0);
  const turonTakenSalary    = (turonData?.salary ?? []).reduce((s, i) => s + i.taken_salary, 0);
  const turonRemaining      = (turonData?.salary ?? []).reduce((s, i) => s + i.remaining_salary, 0);
  const turonCards = [
    { label: "Umumiy Oyliklar Summasi", value: turonTotalSalary },
    { label: "Umumiy Berilgan Oylik",   value: turonTakenSalary,  colorClass: "text-primary" },
    { label: "Umumiy Qolgan Oylik",     value: turonRemaining,    colorClass: "text-amber-500" },
  ];

  const statCards = institution === "turon" ? turonCards : gennisCards;

  return (
    <DashboardLayout
      title="Oyliklar Boshqarma"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/finance")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
          </Button>
          {institution === "turon" ? (
            <div className="flex text-xs border rounded-md overflow-hidden">
              {TURON_TABS.map((t) => (
                <button key={t.key} onClick={() => setTuronTab(t.key)}
                  className={`px-3 py-1.5 transition-colors ${turonTab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex text-xs border rounded-md overflow-hidden">
              {GENNIS_TABS.map((t) => (
                <button key={t.key} onClick={() => setGennisTab(t.key)}
                  className={`px-3 py-1.5 transition-colors ${gennisTab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Filial tanlang" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MonthPicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </div>
      }
    >
      <div className="space-y-5">
        {/* Stat cards */}
        <div className={`grid gap-4 grid-cols-2 ${institution === "turon" ? "lg:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-6"}`}>
          {statCards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                <p className={`text-sm font-bold ${c.colorClass ?? ""}`}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${formatCurrency(c.value)} UZS`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-semibold">
                {institution === "turon"
                  ? TURON_TABS.find((t) => t.key === turonTab)?.label
                  : GENNIS_TABS.find((t) => t.key === gennisTab)?.label}
              </p>
            </div>

            {/* Gennis table */}
            {institution === "gennis" && (
              <div className="overflow-auto max-h-[560px]">
              <Table className="min-w-[560px]">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-10">№</TableHead>
                    <TableHead>Ism Familiya</TableHead>
                    <TableHead className="text-right">Oylik</TableHead>
                    <TableHead className="text-right">Berilgan</TableHead>
                    <TableHead className="text-right">Qolgan</TableHead>
                    <TableHead className="text-right">Qarzdorlik</TableHead>
                    <TableHead className="text-right">Black</TableHead>
                    <TableHead className="text-right">Jarima</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : !gennisData || gennisData.salary_list.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground text-sm">Ma'lumot topilmadi</TableCell></TableRow>
                  ) : gennisData.salary_list.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.teacher_name}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.teacher_salary)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.taken_money)} UZS</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${s.remaining_salary > 0 ? "text-amber-500" : ""}`}>{formatCurrency(s.remaining_salary)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.debt)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.black_salary)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.fine)} UZS</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}

            {/* Turon table */}
            {institution === "turon" && (
              <div className="overflow-auto max-h-[560px]">
              <Table className="min-w-[560px]">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-10">№</TableHead>
                    <TableHead>Ism Familiya</TableHead>
                    {turonTab === "teacher" && <TableHead>Fan</TableHead>}
                    <TableHead className="text-right">Oylik</TableHead>
                    <TableHead className="text-right">Berilgan</TableHead>
                    <TableHead className="text-right">Qolgan</TableHead>
                    <TableHead className="text-right">Naqd</TableHead>
                    <TableHead className="text-right">Bank</TableHead>
                    <TableHead className="text-right">Click</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={turonTab === "teacher" ? 9 : 8} className="h-24 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : !turonData || turonData.salary.length === 0 ? (
                    <TableRow><TableCell colSpan={turonTab === "teacher" ? 9 : 8} className="h-24 text-center text-muted-foreground text-sm">Ma'lumot topilmadi</TableCell></TableRow>
                  ) : turonData.salary.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.name} {s.surname}</TableCell>
                      {turonTab === "teacher" && <TableCell className="text-muted-foreground">{s.subject ?? "—"}</TableCell>}
                      <TableCell className="text-right font-mono">{formatCurrency(s.total_salary)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.taken_salary)} UZS</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${s.remaining_salary > 0 ? "text-amber-500" : ""}`}>{formatCurrency(s.remaining_salary)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.cash)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.bank)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(s.click)} UZS</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
