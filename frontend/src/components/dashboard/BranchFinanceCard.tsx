import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import type { MonthPickerMode } from "@/components/dashboard/MonthPicker";
import { apiFetch } from "@/lib/api";
import { useInstitution } from "@/contexts/InstitutionContext";
import { formatCurrency } from "@/lib/format";
import type { FinanceSummary } from "@/lib/financeSummary";
import { ArrowUpRight, Loader2 } from "lucide-react";

interface CardData {
  tushum: number;
  total_expenses: number;
  remaining: number;
  teacher_salaries: number;
  staff_salaries: number;
  overhead: number;
  capitals: number;
  dividends: number;
  branch_tx_give: number;
  branch_tx_receive: number;
}

interface Props {
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  periodMode: MonthPickerMode;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange(value: string) {
  const [yearValue, monthValue] = value.split("-").map(Number);
  const fallback = new Date();
  const year = Number.isFinite(yearValue) ? yearValue : fallback.getFullYear();
  const month = Number.isFinite(monthValue) ? monthValue - 1 : fallback.getMonth();
  return {
    from: formatDateInput(new Date(year, month, 1)),
    to: formatDateInput(new Date(year, month + 1, 0)),
  };
}

export function BranchFinanceCard({ branchId, branchName, from, to, periodMode }: Props) {
  const { institution } = useInstitution();
  const navigate = useNavigate();
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const effectiveRange = periodMode === "month" ? monthRange(from) : { from, to };

  const openProfile = () => {
    const params = new URLSearchParams();
    params.set("from_date", effectiveRange.from);
    params.set("to_date", effectiveRange.to);
    params.set("period_mode", periodMode);
    params.set("branch_name", branchName);
    navigate(`/dashboard/branches/${branchId}?${params}`);
  };

  useEffect(() => {
    setLoading(true);
    setData(null);

    const params = new URLSearchParams();
    params.set(institution === "turon" ? "branch_id" : "location_id", branchId);
    if (effectiveRange.from) {
      params.set("from_date", effectiveRange.from);
    }
    if (effectiveRange.to) {
      params.set("to_date", effectiveRange.to);
    }

    const endpoint = institution === "turon"
      ? `/statistics/turon/summary?${params}`
      : `/statistics/gennis/summary?${params}`;

    apiFetch(endpoint)
      .then((r) => r.ok ? r.json() : null)
      .then((res: FinanceSummary | null) => {
        if (!res) return;
        setData({
          tushum: res.payments.total,
          teacher_salaries: res.teacher_salaries.total,
          staff_salaries: res.staff_salaries.total,
          overhead: res.overheads.total,
          capitals: res.capitals?.total ?? 0,
          dividends: res.dividends ?? 0,
          branch_tx_give: res.branch_transactions?.give.total ?? 0,
          branch_tx_receive: res.branch_transactions?.receive.total ?? 0,
          total_expenses: res.total_expenses,
          remaining: res.remaining,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [institution, branchId, effectiveRange.from, effectiveRange.to]);

  const foyda = data?.remaining ?? 0;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      role="button"
      tabIndex={0}
      onClick={openProfile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openProfile();
      }}
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <p className="text-sm font-semibold">{branchName}</p>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Yuklanmoqda...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6">
            {/* B/S */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">B/S</p>
              <Row label="Tushum" amount={data?.tushum ?? 0} />
              <Row label="Jami xarajat" amount={data?.total_expenses ?? 0} negative />
              <div className="border-t pt-1.5 mt-1.5">
                <Row label="Qoldiq" amount={data?.remaining ?? 0} bold color={foyda >= 0 ? "text-green-500" : "text-destructive"} />
              </div>
            </div>

            {/* I/S */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">I/S</p>
              <Row label="Tushum" amount={data?.tushum ?? 0} />
              <Row label="O'qituvchi oyliklari" amount={data?.teacher_salaries ?? 0} negative />
              <Row label="Xodim oyliklari" amount={data?.staff_salaries ?? 0} negative />
              <Row label="Overhead" amount={data?.overhead ?? 0} negative />
              <Row label="Kapital" amount={data?.capitals ?? 0} negative />
              <Row label="Filialga berildi" amount={data?.branch_tx_give ?? 0} negative />
              <Row label="Filialdan olindi" amount={data?.branch_tx_receive ?? 0} />
              <Row label="Dividendlar" amount={data?.dividends ?? 0} negative />
              <div className={`rounded-md px-2 py-1.5 mt-1 ${foyda >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
                <Row
                  label={foyda >= 0 ? "Foyda" : "Zarar"}
                  amount={Math.abs(foyda)}
                  bold
                  color={foyda >= 0 ? "text-green-500" : "text-destructive"}
                  prefix={foyda >= 0 ? "+" : "−"}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label, amount, negative = false, bold = false, color, prefix,
}: {
  label: string; amount: number; negative?: boolean;
  bold?: boolean; color?: string; prefix?: string;
}) {
  const amountColor = color ?? (negative ? "text-destructive" : "");
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? "font-medium" : ""}`}>{label}</span>
      <span className={`text-xs font-mono ${bold ? "font-semibold" : ""} ${amountColor}`}>
        {prefix ?? (negative ? "−" : "")}{formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}
