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

// ── Gennis types ─────────────────────────────────────────────────
interface GennisGroup {
  group_name: string;
  subject_name: string;
  remaining_debt: number;
  total_debt: number;
  payment: number;
  total_discount: number;
  for_student_total_discount: number;
}
interface GennisStudent {
  id: number;
  student_name: string;
  month: string;
  is_deleted: boolean;
  groups: GennisGroup[];
}
interface GennisDebtorsData {
  student_list: GennisStudent[];
  total_debt: number;
  remaining_debt: number;
  payment: number;
  total_discount: number;
  total_first_discount: number;
}

// ── Turon types ──────────────────────────────────────────────────
interface TuronStudent {
  id: number;
  name: string;
  surname: string;
  phone: string;
  total_debt: number;
  remaining_debt: number;
  cash: number;
  bank: number;
  click: number;
  total_dis: number;
  total_discount: number;
  month_id: number;
}
interface TuronClass {
  class_number: string;
  students: TuronStudent[];
}
interface PaymentByType {
  payment_type: string;
  total: number;
}
interface TuronStudentsData {
  class: TuronClass[];
  by_payment_type: PaymentByType[];
  total_sum: number;
  total_debt: number;
  reaming_debt: number;   // API typo
  total_dis: number;
  total_discount: number;
  total_with_discount: number;
}

interface StatCard {
  label: string;
  value: number | null;
  count?: number;
  neg?: boolean;
  color?: string;
}

export default function DebtorsPage() {
  const navigate = useNavigate();
  const { institution } = useInstitution();
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [to, setTo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [gennisData, setGennisData] = useState<GennisDebtorsData | null>(null);
  const [turonData, setTuronData] = useState<TuronStudentsData | null>(null);
  const [loading, setLoading] = useState(false);

  const [fromYear, fromMonthStr] = from.split("-");
  const month = parseInt(fromMonthStr ?? "1") - 1;
  const year = parseInt(fromYear ?? String(now.getFullYear()));

  useEffect(() => {
    apiFetch(`/${institution}/branches`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: Branch[]) => {
        const list = Array.isArray(d) ? d : [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(String(list[0].id));
      })
      .catch(() => { });
  }, [institution]);

  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);
    setGennisData(null);
    setTuronData(null);

    if (institution === "turon") {
      apiFetch(`/turon/school-students?branch=${selectedBranch}&month=${month + 1}&year=${year}`)
        .then((r) => r.ok ? r.json() : null)
        .then((res) => { if (res) setTuronData(res); })
        .catch(() => { })
        .finally(() => setLoading(false));
    } else {
      apiFetch(`/gennis/debtors?location_id=${selectedBranch}&month=${month + 1}&year=${year}`)
        .then((r) => r.ok ? r.json() : null)
        .then((res) => { if (res) setGennisData(res); })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [institution, selectedBranch, month, year]);

  // Turon: sort by class_number first, then by remaining_debt desc within each class
  const turonStudents: (TuronStudent & { class_number: string })[] =
    (turonData?.class ?? []).flatMap((c) =>
      [...c.students]
        .sort((a, b) => Math.abs(b.remaining_debt) - Math.abs(a.remaining_debt))
        .map((s) => ({ ...s, class_number: c.class_number }))
    );

  // Gennis: is_deleted=false first, then sort by remaining_debt desc within each group
  const genниsSortedStudents = [...(gennisData?.student_list ?? [])].sort((a, b) => {
    if (a.is_deleted !== b.is_deleted) return a.is_deleted ? 1 : -1;
    const aDebt = a.groups.reduce((s, g) => s + Math.abs(g.remaining_debt), 0);
    const bDebt = b.groups.reduce((s, g) => s + Math.abs(g.remaining_debt), 0);
    return bDebt - aDebt;
  });

  const turonTotalDebt = turonStudents.reduce((a, s) => a + s.total_debt, 0);
  const turonTotalPaid = turonStudents.reduce((a, s) => a + s.cash + s.bank + s.click, 0);
  const turonTotalRemain = turonStudents.reduce((a, s) => a + s.remaining_debt, 0);
  const turonTotalDis = turonStudents.reduce((a, s) => a + s.total_dis + s.total_discount, 0);

  const turonPaymentTypes = turonData?.by_payment_type ?? [];
  const turonCash = turonPaymentTypes.find((p) => p.payment_type === "cash")?.total ?? 0;
  const turonBank = turonPaymentTypes.find((p) => p.payment_type === "bank")?.total ?? 0;
  const turonClick = turonPaymentTypes.find((p) => p.payment_type === "click")?.total ?? 0;

  const statCards: StatCard[] = institution === "turon"
    ? [
      { label: "Hisoblangan to'lov", value: turonData?.total_debt ?? 0, neg: true, color: "#ef4444" },
      { label: "Jami To'langan", value: turonData?.total_sum ?? 0, color: "#10b981" },
      { label: "Qolgan", value: turonData?.reaming_debt ?? 0, neg: true, color: "#f59e0b" },
      { label: "Chegirma", value: turonData?.total_dis ?? 0, color: "#6366f1" },
      { label: "Bir martalik chegirma", value: turonData?.total_discount ?? 0, color: "#8b5cf6" },
      { label: "Umumiy Qarzdorlar", value: null, count: turonStudents.length, color: "#64748b" },
    ]
    : [
      { label: "Hisoblangan to'lov", value: gennisData?.total_debt ?? 0, neg: true, color: "#ef4444" },
      { label: "To'langan", value: gennisData?.payment ?? 0, color: "#22c55e" },
      { label: "Qolgan", value: gennisData?.remaining_debt ?? 0, neg: true, color: "#f59e0b" },
      { label: "Chegirma", value: gennisData?.total_discount ?? 0, color: "#6366f1" },
      { label: "Bir martalik chegirma", value: gennisData?.total_first_discount ?? 0, color: "#8b5cf6" },
      { label: "Umumiy Qarzdorlar", value: null, count: gennisData?.student_list.length ?? 0, color: "#64748b" },
    ];

  return (
    <DashboardLayout
      title="O'quvchilar Qarzdorligi"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/finance")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
          </Button>
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
      <div className="flex flex-col gap-5 flex-1 min-h-0">
        {/* Stat cards */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((c) => {
            const isTotalPaid = institution === "turon" && c.label === "Jami To'langan";
            const cardEl = (
              <Card key={c.label} className={isTotalPaid ? "relative group cursor-default" : ""}>
                <CardContent className="p-4 border-t-2" style={{ borderTopColor: c.color }}>
                  <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : c.count !== undefined ? (
                    <p className="text-base font-bold">{c.count}</p>
                  ) : (
                    <p className={`text-base font-bold ${c.neg ? "text-destructive" : ""}`}>
                      {c.neg && Math.abs(c.value ?? 0) !== 0 ? "-" : ""}{formatCurrency(Math.abs(c.value ?? 0))} UZS
                    </p>
                  )}
                  {isTotalPaid && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:flex flex-col gap-1.5 z-50 bg-popover border rounded-lg shadow-lg p-3 w-56">
                      {[
                        { label: "Naqd", value: turonCash, color: "#22c55e" },
                        { label: "Bank", value: turonBank, color: "#3b82f6" },
                        { label: "Click", value: turonClick, color: "#8b5cf6" },
                      ].map((p) => (
                        <div key={p.label} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                            {p.label}
                          </span>
                          <span className="font-mono font-medium">{formatCurrency(p.value)} UZS</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
            return cardEl;
          })}
        </div>

        {/* Table — Gennis */}
        {institution === "gennis" && (
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
              <div className="px-4 pt-4 pb-2 shrink-0">
                <p className="text-sm font-semibold">O'quvchi Qarzdorligi Jadavali</p>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <Table className="min-w-[500px] border-separate border-spacing-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 left-0 z-30 bg-muted whitespace-nowrap">O'quvchi</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right whitespace-nowrap">Hisoblangan to'lov</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right whitespace-nowrap">To'langan</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right font-semibold whitespace-nowrap">Qolgan</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right whitespace-nowrap">Chegirma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : genниsSortedStudents.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground text-sm">Ma'lumot topilmadi</TableCell></TableRow>
                    ) : genниsSortedStudents.map((s, i) => {
                      const totalDebt = s.groups.reduce((a, g) => a + g.total_debt, 0);
                      const payment = s.groups.reduce((a, g) => a + g.payment, 0);
                      const remaining = s.groups.reduce((a, g) => a + g.remaining_debt, 0);
                      const discount = s.groups.reduce((a, g) => a + g.total_discount, 0);
                      const prevIsDeleted = i > 0 && genниsSortedStudents[i - 1].is_deleted !== s.is_deleted;
                      return (
                        <TableRow key={s.id} className={s.is_deleted ? "opacity-40" : ""} style={prevIsDeleted ? { borderTop: "2px solid hsl(var(--border))" } : undefined}>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">{s.student_name}</TableCell>
                          <TableCell className="text-right font-mono text-destructive whitespace-nowrap">-{formatCurrency(Math.abs(totalDebt))} UZS</TableCell>
                          <TableCell className="text-right font-mono whitespace-nowrap">{formatCurrency(Math.abs(payment))} UZS</TableCell>
                          <TableCell className={`text-right font-mono font-semibold whitespace-nowrap ${remaining !== 0 ? "text-destructive" : ""}`}>
                            {remaining !== 0 ? `-${formatCurrency(Math.abs(remaining))}` : "0"} UZS
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">{formatCurrency(Math.abs(discount))} UZS</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table — Turon */}
        {institution === "turon" && (
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
              <div className="px-4 pt-4 pb-2 shrink-0">
                <p className="text-sm font-semibold">O'quvchi Qarzdorligi Jadavali</p>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <Table className="min-w-[580px] border-separate border-spacing-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 left-0 z-30 bg-muted whitespace-nowrap">O'quvchi</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted whitespace-nowrap">Sinf</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right whitespace-nowrap">Hisoblangan to'lov</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right whitespace-nowrap">To'langan</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right font-semibold whitespace-nowrap">Qolgan</TableHead>
                      <TableHead className="sticky top-0 z-20 bg-muted text-right whitespace-nowrap">Chegirma</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : turonStudents.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">Ma'lumot topilmadi</TableCell></TableRow>
                    ) : turonStudents.map((s) => {
                      const paid = s.cash + s.bank + s.click;
                      const discount = s.total_dis + s.total_discount;
                      return (
                        <TableRow key={s.month_id}>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">{s.name} {s.surname}</TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{s.class_number}</TableCell>
                          <TableCell className="text-right font-mono text-destructive whitespace-nowrap">-{formatCurrency(s.total_debt)} UZS</TableCell>
                          <TableCell className="text-right font-mono whitespace-nowrap">{formatCurrency(paid)} UZS</TableCell>
                          <TableCell className={`text-right font-mono font-semibold whitespace-nowrap ${s.remaining_debt !== 0 ? "text-destructive" : ""}`}>
                            {s.remaining_debt !== 0 ? `-${formatCurrency(s.remaining_debt)}` : "0"} UZS
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground whitespace-nowrap">{formatCurrency(discount)} UZS</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
