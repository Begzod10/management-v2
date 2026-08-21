import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthPicker } from "@/components/dashboard/MonthPicker";
import type { MonthPickerMode } from "@/components/dashboard/MonthPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useInstitution } from "@/contexts/InstitutionContext";
import type { FinanceOverheadsSummary, FinancePaymentTypeTotal, FinanceSummary } from "@/lib/financeSummary";

interface Branch {
  id: number;
  name: string;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date: Date) {
  return formatDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthEnd(date: Date) {
  return formatDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function monthRangeFromValue(value: string) {
  const [yearValue, monthValue] = value.split("-").map(Number);
  const fallback = new Date();
  const year = Number.isFinite(yearValue) ? yearValue : fallback.getFullYear();
  const month = Number.isFinite(monthValue) ? monthValue - 1 : fallback.getMonth();
  return {
    from: formatDateInput(new Date(year, month, 1)),
    to: formatDateInput(new Date(year, month + 1, 0)),
  };
}

function money(value: number | null | undefined) {
  return `${formatCurrency(Math.abs(value ?? 0))} UZS`;
}

function paymentTypeLabel(value: string | null | undefined) {
  if (!value) return "-";
  const labels: Record<string, string> = {
    cash: "Naqd",
    click: "Click",
    payme: "Payme",
    bank: "Bank",
  };
  return labels[value] ?? value;
}

function Amount({ value, negative = false, positive = false }: { value: number; negative?: boolean; positive?: boolean }) {
  const color = positive ? "text-green-600" : negative ? "text-destructive" : "";
  const prefix = positive ? "+" : negative ? "- " : "";
  return <span className={`font-mono font-medium whitespace-nowrap tabular-nums ${color}`}>{prefix}{money(value)}</span>;
}

function SummaryCard({
  title,
  value,
  hint,
  negative,
  positive,
}: {
  title: string;
  value: number;
  hint: string;
  negative?: boolean;
  positive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        <div className="mt-2 text-xl font-semibold tracking-tight">
          <Amount value={value} negative={negative} positive={positive} />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function PaymentTypeTable({ rows }: { rows: FinancePaymentTypeTotal[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Ma'lumot yo'q</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>To'lov turi</TableHead>
          <TableHead className="text-right">Summa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.payment_type}-${row.total}`}>
            <TableCell>{paymentTypeLabel(row.payment_type)}</TableCell>
            <TableCell className="text-right"><Amount value={row.total} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SectionDetails({
  title,
  total,
  rows,
  negative = false,
}: {
  title: string;
  total: number;
  rows: FinancePaymentTypeTotal[];
  negative?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <Amount value={total} negative={negative} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <PaymentTypeTable rows={rows} />
      </CardContent>
    </Card>
  );
}

function overheadRows(overheads: FinanceOverheadsSummary) {
  if (overheads.by_item?.length) {
    return overheads.by_item.map((item) => ({ name: item.item || "-", total: item.total }));
  }
  return (overheads.by_overhead_type ?? []).map((item) => ({ name: item.type || "-", total: item.total }));
}

export default function DashboardBranchProfilePage() {
  const { branchId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { institution } = useInstitution();
  const now = useMemo(() => new Date(), []);
  const from = searchParams.get("from_date") || monthStart(now);
  const to = searchParams.get("to_date") || monthEnd(now);
  const periodMode: MonthPickerMode = searchParams.get("period_mode") === "range" ? "range" : "month";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedBranch = branches.find((branch) => String(branch.id) === branchId);
  const hasBranchInCurrentSystem = !!selectedBranch;
  const branchName = selectedBranch?.name || searchParams.get("branch_name") || `Filial #${branchId ?? ""}`;
  const effectiveRange = periodMode === "month" ? monthRangeFromValue(from) : { from, to };

  const navigateToProfile = (
    nextBranchId: string,
    nextFrom = from,
    nextTo = to,
    nextBranchName?: string,
    replace = false,
    nextPeriodMode: MonthPickerMode = periodMode,
  ) => {
    const nextRange = nextPeriodMode === "month" ? monthRangeFromValue(nextFrom) : { from: nextFrom, to: nextTo };
    const params = new URLSearchParams();
    params.set("from_date", nextRange.from);
    params.set("to_date", nextRange.to);
    params.set("period_mode", nextPeriodMode);
    if (nextBranchName) params.set("branch_name", nextBranchName);
    navigate(`/dashboard/branches/${nextBranchId}?${params}`, { replace });
  };

  useEffect(() => {
    setBranchesLoading(true);
    setBranches([]);
    setData(null);
    setError(null);
    apiFetch(`/${institution}/branches`)
      .then((response) => response.ok ? response.json() : [])
      .then((items) => setBranches(Array.isArray(items) ? items : []))
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
  }, [institution]);

  useEffect(() => {
    if (branchesLoading || branches.length === 0) return;
    const branchIsValid = branches.some((branch) => String(branch.id) === branchId);
    if (!branchIsValid) {
      const nextBranch = branches[0];
      setData(null);
      setError(null);
      navigateToProfile(String(nextBranch.id), effectiveRange.from, effectiveRange.to, nextBranch.name, true);
    }
  }, [branchId, branches, branchesLoading, effectiveRange.from, effectiveRange.to]);

  useEffect(() => {
    if (!branchId || branchesLoading || !hasBranchInCurrentSystem) return;
    let ignore = false;

    const params = new URLSearchParams();
    params.set(institution === "turon" ? "branch_id" : "location_id", branchId);
    params.set("from_date", effectiveRange.from);
    params.set("to_date", effectiveRange.to);

    setLoading(true);
    setError(null);
    setData(null);

    apiFetch(`/statistics/${institution}/summary?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        return response.json() as Promise<FinanceSummary>;
      })
      .then((summary) => {
        if (!ignore) setData(summary);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : "Ma'lumotlarni yuklashda xatolik");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [branchId, branchesLoading, effectiveRange.from, effectiveRange.to, hasBranchInCurrentSystem, institution]);

  const details = data ? overheadRows(data.overheads) : [];
  const profit = data?.remaining ?? 0;
  const capitalsTotal = data?.capitals?.total ?? 0;
  const branchTxGive = data?.branch_transactions?.give.total ?? 0;
  const branchTxReceive = data?.branch_transactions?.receive.total ?? 0;
  const branchTxNet = data?.branch_transactions?.net ?? 0;
  const branchSelect = (
    <Select
      value={hasBranchInCurrentSystem ? branchId ?? "" : ""}
      disabled={branchesLoading || branches.length === 0}
      onValueChange={(value) => {
        const nextBranch = branches.find((branch) => String(branch.id) === value);
        navigateToProfile(value, effectiveRange.from, effectiveRange.to, nextBranch?.name);
      }}
    >
      <SelectTrigger className="h-8 w-44 text-xs">
        <SelectValue placeholder={branchesLoading ? "Yuklanmoqda..." : "Filial tanlang"} />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <DashboardLayout
      title={branchName}
      headerExtra={
        <div className="flex items-center gap-2">
          {branchSelect}
          <MonthPicker
            from={effectiveRange.from}
            to={effectiveRange.to}
            mode={periodMode}
            onModeChange={(value) => {
              if (value === "range") {
                navigateToProfile(branchId ?? "", effectiveRange.from, effectiveRange.to, branchName, true, value);
              }
            }}
            onRangeChange={(nextFrom, nextTo) => {
              navigateToProfile(branchId ?? "", nextFrom, nextTo, branchName, false, "month");
            }}
            onFromChange={(value) => {
              const nextTo = value && effectiveRange.to && value > effectiveRange.to ? value : effectiveRange.to;
              navigateToProfile(branchId ?? "", value, nextTo, branchName, false, "range");
            }}
            onToChange={(value) => {
              const nextFrom = value && effectiveRange.from && value < effectiveRange.from ? value : effectiveRange.from;
              navigateToProfile(branchId ?? "", nextFrom, value, branchName, false, "range");
            }}
          />
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span>{branchName}</span>
            </h2>
          <p className="text-sm text-muted-foreground">{effectiveRange.from} - {effectiveRange.to}</p>
          </div>
        </div>

        {loading && (
          <div className="flex min-h-48 items-center justify-center rounded-md border text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Ma'lumotlar yuklanmoqda
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <SummaryCard title="Tushum" value={data.payments.total} hint="Umumiy" positive />
              <SummaryCard title="Tushum (investitsiyasiz)" value={data.payments.total - (data.investments ?? 0)} hint="Investitsiyalar chiqarilgan" positive />
              <SummaryCard title="Investitsiyalar" value={data.investments ?? 0} hint="Investitsiyalar" positive />
              <SummaryCard title="O'qituvchi oyliklari" value={data.teacher_salaries.total} hint="O'qituvchi oyliklari" negative />
              <SummaryCard title="Xodim oyliklari" value={data.staff_salaries.total} hint="Xodim oyliklari" negative />
              <SummaryCard title="Overhead" value={data.overheads.total} hint="Xarajatlar" negative />
              <SummaryCard title="Kapital" value={capitalsTotal} hint="Kapital xarajatlar" negative />
              <SummaryCard title="Filialga berildi" value={branchTxGive} hint="Filial tranzaksiyalari" negative />
              <SummaryCard title="Filialdan olindi" value={branchTxReceive} hint="Filial tranzaksiyalari" positive />
              <SummaryCard title="Jami xarajat" value={data.total_expenses} hint="Umumiy chiqim" negative />
              <SummaryCard title={profit >= 0 ? "Foyda" : "Zarar"} value={Math.abs(profit)} hint="Qoldiq" positive={profit >= 0} negative={profit < 0} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionDetails title="To'lovlar" total={data.payments.total} rows={data.payments.by_payment_type} />
              <SectionDetails title="O'qituvchi oyliklari" total={data.teacher_salaries.total} rows={data.teacher_salaries.by_payment_type} negative />
              <SectionDetails title="Xodim oyliklari" total={data.staff_salaries.total} rows={data.staff_salaries.by_payment_type} negative />
              <SectionDetails title="Overhead to'lov turlari" total={data.overheads.total} rows={data.overheads.by_payment_type} negative />
              <SectionDetails title="Kapital to'lov turlari" total={capitalsTotal} rows={data.capitals?.by_payment_type ?? []} negative />
              <SectionDetails title="Filialga berildi" total={branchTxGive} rows={data.branch_transactions?.give.by_payment_type ?? []} negative />
              <SectionDetails title="Filialdan olindi" total={branchTxReceive} rows={data.branch_transactions?.receive.by_payment_type ?? []} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Overhead tafsilotlari</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {details.length ? (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nomi</TableHead>
                        <TableHead className="text-right w-36">Summa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.map((item) => (
                        <TableRow key={`${item.name}-${item.total}`}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right"><Amount value={item.total} negative /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Overhead tafsilotlari yo'q</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Qo'shimcha ko'rsatkichlar</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Dividendlar</div>
                  <div className="mt-1"><Amount value={data.dividends ?? 0} negative /></div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Kapital</div>
                  <div className="mt-1"><Amount value={capitalsTotal} negative /></div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Investitsiyalar</div>
                  <div className="mt-1"><Amount value={data.investments ?? 0} /></div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Filial tranzaksiyalari</div>
                  <div className="mt-1"><Amount value={Math.abs(branchTxNet)} positive={branchTxNet >= 0} negative={branchTxNet < 0} /></div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Jami xarajat</div>
                  <div className="mt-1"><Amount value={data.total_expenses} negative /></div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Qoldiq</div>
                  <div className="mt-1"><Amount value={Math.abs(data.remaining)} positive={data.remaining >= 0} negative={data.remaining < 0} /></div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
