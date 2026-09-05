import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MonthPicker } from "@/components/dashboard/MonthPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Loader2 } from "lucide-react";

// ── Income Statement (Foyda va Zarar) ───────────────────────────────────────
// Deliberately NOT its own backend computation — reads the exact same
// GET /statistics/overview the main dashboard's OverviewCard already shows,
// just reshaped into an explicit Revenue/Expense statement. Keeping one
// source of truth means this page can never show a different profit/loss
// figure than the dashboard for the same period.

interface Branch { id: number; name: string }

interface InstitutionStats {
  payments: { total: number };
  teacher_salaries: { total: number };
  staff_salaries: { total: number };
  overheads: { total: number };
  capitals: { total: number };
  branch_transactions?: { give: { total: number }; receive: { total: number }; net: number };
  dividends: number;
  investments: number;
  total_expenses: number;
  remaining: number;
}

interface OverviewData {
  gennis: InstitutionStats;
  turon: InstitutionStats;
  combined: {
    total_payments: number;
    total_teacher_salaries: number;
    total_staff_salaries: number;
    total_overheads: number;
    total_capitals: number;
    total_branch_tx_give?: number;
    total_branch_tx_receive?: number;
    total_dividends: number;
    total_investments: number;
    total_expenses: number;
    remaining: number;
  };
}

interface BalanceSheetAssets {
  cash: number;
  receivables: number;
  loans_receivable: number;
  total: number;
}
interface BalanceSheetLiabilities {
  unpaid_salaries: number;
  loans_payable: number;
  total: number;
}
interface BalanceSheetSection {
  assets: BalanceSheetAssets;
  liabilities: BalanceSheetLiabilities;
  net_worth: number;
}
interface BalanceSheetData {
  as_of: string;
  gennis: BalanceSheetSection;
  turon: BalanceSheetSection;
  combined: BalanceSheetSection;
}

interface BranchFilterProps {
  gennisLocationId: string;
  turonBranchId: string;
}

function StatementRow({ label, amount, indent = false, bold = false, negative = false }: {
  label: string; amount: number; indent?: boolean; bold?: boolean; negative?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent ? "pl-4" : ""} ${bold ? "border-t mt-1 pt-2" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-sm font-mono tabular-nums ${bold ? "font-semibold" : ""} ${negative ? "text-destructive" : ""}`}>
        {negative ? "−" : ""}{formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}

function IncomeStatementCard({ title, stats }: { title: string; stats: InstitutionStats }) {
  const revenue = stats.payments.total + stats.dividends + (stats.branch_transactions?.receive.total ?? 0);
  const profitable = stats.remaining >= 0;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Daromadlar</p>
        <StatementRow label="O'quvchilar to'lovlari" amount={stats.payments.total} indent />
        <StatementRow label="Dividendlar" amount={stats.dividends} indent />
        <StatementRow label="Filialdan olindi" amount={stats.branch_transactions?.receive.total ?? 0} indent />
        <StatementRow label="Jami daromad" amount={revenue} bold />

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">Xarajatlar</p>
        <StatementRow label="O'qituvchi oyliklari" amount={stats.teacher_salaries.total} indent />
        <StatementRow label="Xodim oyliklari" amount={stats.staff_salaries.total} indent />
        <StatementRow label="Qo'shimcha xarajatlar" amount={stats.overheads.total} indent />
        <StatementRow label="Kapital xarajatlar" amount={stats.capitals.total} indent />
        <StatementRow label="Investitsiyalar" amount={stats.investments} indent />
        <StatementRow label="Filialga berildi" amount={stats.branch_transactions?.give.total ?? 0} indent />
        <StatementRow label="Jami xarajat" amount={stats.total_expenses} bold />

        <div className={`mt-3 rounded-md px-3 py-2 flex items-center justify-between ${profitable ? "bg-green-500/10" : "bg-destructive/10"}`}>
          <span className="text-sm font-semibold">{profitable ? "SOF FOYDA" : "SOF ZARAR"}</span>
          <span className={`text-base font-mono font-bold tabular-nums ${profitable ? "text-green-500" : "text-destructive"}`}>
            {profitable ? "+" : "−"}{formatCurrency(Math.abs(stats.remaining))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function IncomeStatementTab({ gennisLocationId, turonBranchId }: BranchFilterProps) {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [to, setTo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set("from_date", from);
    if (to) p.set("to_date", to);
    if (gennisLocationId !== "all") p.set("gennis_location_id", gennisLocationId);
    if (turonBranchId !== "all") p.set("turon_branch_id", turonBranchId);
    apiFetch(`/statistics/overview?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res: OverviewData | null) => { if (res) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to, gennisLocationId, turonBranchId]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MonthPicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground text-center py-12">Ma'lumot topilmadi</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <IncomeStatementCard title="Gennis" stats={data.gennis} />
          <IncomeStatementCard title="Turon" stats={data.turon} />
          <IncomeStatementCard
            title="Jami"
            stats={{
              payments: { total: data.combined.total_payments },
              teacher_salaries: { total: data.combined.total_teacher_salaries },
              staff_salaries: { total: data.combined.total_staff_salaries },
              overheads: { total: data.combined.total_overheads },
              capitals: { total: data.combined.total_capitals },
              branch_transactions: {
                give: { total: data.combined.total_branch_tx_give ?? 0 },
                receive: { total: data.combined.total_branch_tx_receive ?? 0 },
                net: 0,
              },
              dividends: data.combined.total_dividends,
              investments: data.combined.total_investments,
              total_expenses: data.combined.total_expenses,
              remaining: data.combined.remaining,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Balance Sheet (Balans) ───────────────────────────────────────────────────
// Live snapshot only — see backend app/routers/v1/management/reports.py's
// module docstring for exactly what each line means. "Sof aktivlar" (net
// worth) is a derived Assets-minus-Liabilities figure, not an independently
// tracked owner-equity ledger — this is a management snapshot, not a
// certified accrual balance sheet.

function BalanceSheetSectionCard({ title, section }: { title: string; section: BalanceSheetSection }) {
  const positive = section.net_worth >= 0;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Aktivlar</p>
        <StatementRow label="Naqd mablag' (kumulyativ)" amount={section.assets.cash} indent />
        <StatementRow label="Talabalardan qarzlar" amount={section.assets.receivables} indent />
        <StatementRow label="Filiallarga berilgan qarzlar" amount={section.assets.loans_receivable} indent />
        <StatementRow label="Jami aktivlar" amount={section.assets.total} bold />

        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">Majburiyatlar</p>
        <StatementRow label="To'lanmagan ish haqi" amount={section.liabilities.unpaid_salaries} indent />
        <StatementRow label="Filiallardan olingan qarzlar" amount={section.liabilities.loans_payable} indent />
        <StatementRow label="Jami majburiyatlar" amount={section.liabilities.total} bold />

        <div className={`mt-3 rounded-md px-3 py-2 flex items-center justify-between ${positive ? "bg-green-500/10" : "bg-destructive/10"}`}>
          <span className="text-sm font-semibold">SOF AKTIVLAR</span>
          <span className={`text-base font-mono font-bold tabular-nums ${positive ? "text-green-500" : "text-destructive"}`}>
            {positive ? "+" : "−"}{formatCurrency(Math.abs(section.net_worth))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceSheetTab({ gennisLocationId, turonBranchId }: BranchFilterProps) {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (gennisLocationId !== "all") p.set("gennis_location_id", gennisLocationId);
    if (turonBranchId !== "all") p.set("turon_branch_id", turonBranchId);
    apiFetch(`/reports/balance-sheet?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res: BalanceSheetData | null) => { if (res) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gennisLocationId, turonBranchId]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {data ? `Holat: ${new Date(data.as_of).toLocaleString("uz-UZ")} holatiga ko'ra` : "Har doim joriy holat — davr tanlanmaydi."}
      </p>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground text-center py-12">Ma'lumot topilmadi</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BalanceSheetSectionCard title="Gennis" section={data.gennis} />
          <BalanceSheetSectionCard title="Turon" section={data.turon} />
          <BalanceSheetSectionCard title="Jami" section={data.combined} />
        </div>
      )}
    </div>
  );
}

export default function FinancialStatementsPage() {
  const [gennisBranches, setGennisBranches] = useState<Branch[]>([]);
  const [turonBranches, setTuronBranches] = useState<Branch[]>([]);
  const [gennisLocationId, setGennisLocationId] = useState("all");
  const [turonBranchId, setTuronBranchId] = useState("all");

  useEffect(() => {
    apiFetch("/gennis/branches")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Branch[]) => setGennisBranches(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch("/turon/branches")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Branch[]) => setTuronBranches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const branchFilters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={gennisLocationId} onValueChange={setGennisLocationId}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="Gennis filial" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Gennis — barcha filiallar</SelectItem>
          {gennisBranches.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={turonBranchId} onValueChange={setTuronBranchId}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="Turon filial" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Turon — barcha filiallar</SelectItem>
          {turonBranches.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DashboardLayout title="Moliyaviy hisobotlar" headerExtra={branchFilters}>
      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Foyda va Zarar</TabsTrigger>
          <TabsTrigger value="balance">Balans</TabsTrigger>
        </TabsList>
        <TabsContent value="income" className="mt-4">
          <IncomeStatementTab gennisLocationId={gennisLocationId} turonBranchId={turonBranchId} />
        </TabsContent>
        <TabsContent value="balance" className="mt-4">
          <BalanceSheetTab gennisLocationId={gennisLocationId} turonBranchId={turonBranchId} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
