import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Loader2 } from "lucide-react";

interface InstitutionStats {
  payments: { total: number };
  teacher_salaries: { total: number };
  staff_salaries: { total: number };
  overheads: { total: number };
  branch_transactions?: {
    give: { total: number };
    receive: { total: number };
    net: number;
  };
  dividends: number;
  total_expenses: number;
  remaining: number;
}

interface OverviewData {
  period: { month: number; year: number };
  gennis: InstitutionStats;
  turon: InstitutionStats;
  combined: {
    total_payments: number;
    total_teacher_salaries: number;
    total_staff_salaries: number;
    total_overheads: number;
    total_branch_tx_give?: number;
    total_branch_tx_receive?: number;
    total_branch_tx_net?: number;
    total_dividends: number;
    total_expenses: number;
    remaining: number;
  };
}

interface Props {
  from: string;
  to: string;
  gennisLocationId?: string;
  turonBranchId?: string;
}

export function OverviewCard({ from, to, gennisLocationId, turonBranchId }: Props) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);

    const p = new URLSearchParams();
    if (from) {
      p.set("from_date", from);
    }
    if (to) {
      p.set("to_date", to);
    }
    if (gennisLocationId) p.set("gennis_location_id", gennisLocationId);
    if (turonBranchId) p.set("turon_branch_id", turonBranchId);

    apiFetch(`/statistics/overview?${p}`)
      .then((r) => r.ok ? r.json() : null)
      .then((res: OverviewData | null) => { if (res) setData(res); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to, gennisLocationId, turonBranchId]);

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-3 pb-2 border-b">Umumiy ko'rsatkichlar</p>

        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Yuklanmoqda...</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-x-3 sm:gap-x-6">
            {/* Gennis */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Gennis</p>
              <Row label="Tushum" amount={data?.gennis.payments.total ?? 0} />
              <Row label="O'qituvchi oyliklari" amount={data?.gennis.teacher_salaries.total ?? 0} negative />
              <Row label="Xodim oyliklari" amount={data?.gennis.staff_salaries.total ?? 0} negative />
              <Row label="Overhead" amount={data?.gennis.overheads.total ?? 0} negative />
              <Row label="Filialga berildi" amount={data?.gennis.branch_transactions?.give.total ?? 0} negative />
              <Row label="Filialdan olindi" amount={data?.gennis.branch_transactions?.receive.total ?? 0} />
              <Row label="Dividendlar" amount={data?.gennis.dividends ?? 0} negative />
              <div className="border-t pt-1.5 mt-1.5">
                <ProfitRow value={data?.gennis.remaining ?? 0} />
              </div>
            </div>

            {/* Turon */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Turon</p>
              <Row label="Tushum" amount={data?.turon.payments.total ?? 0} />
              <Row label="O'qituvchi oyliklari" amount={data?.turon.teacher_salaries.total ?? 0} negative />
              <Row label="Xodim oyliklari" amount={data?.turon.staff_salaries.total ?? 0} negative />
              <Row label="Overhead" amount={data?.turon.overheads.total ?? 0} negative />
              <Row label="Filialga berildi" amount={data?.turon.branch_transactions?.give.total ?? 0} negative />
              <Row label="Filialdan olindi" amount={data?.turon.branch_transactions?.receive.total ?? 0} />
              <Row label="Dividendlar" amount={data?.turon.dividends ?? 0} negative />
              <div className="border-t pt-1.5 mt-1.5">
                <ProfitRow value={data?.turon.remaining ?? 0} />
              </div>
            </div>

            {/* Combined */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Jami</p>
              <Row label="Tushum" amount={data?.combined.total_payments ?? 0} bold />
              <Row label="O'qituvchi oyliklari" amount={data?.combined.total_teacher_salaries ?? 0} negative />
              <Row label="Xodim oyliklari" amount={data?.combined.total_staff_salaries ?? 0} negative />
              <Row label="Overhead" amount={data?.combined.total_overheads ?? 0} negative />
              <Row label="Filialga berildi" amount={data?.combined.total_branch_tx_give ?? 0} negative />
              <Row label="Filialdan olindi" amount={data?.combined.total_branch_tx_receive ?? 0} />
              <Row label="Dividendlar" amount={data?.combined.total_dividends ?? 0} negative />
              <div className="border-t pt-1.5 mt-1.5">
                <ProfitRow value={data?.combined.remaining ?? 0} bold />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, amount, negative = false, bold = false }: {
  label: string; amount: number; negative?: boolean; bold?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
      <span className={`text-[10px] leading-tight text-muted-foreground sm:text-xs sm:text-foreground ${bold ? "font-medium" : ""}`}>{label}</span>
      <span className={`text-xs font-mono tabular-nums whitespace-nowrap shrink-0 sm:ml-1 ${bold ? "font-semibold" : ""} ${negative ? "text-destructive" : ""}`}>
        {negative ? "−" : ""}{formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}

function ProfitRow({ value, bold = false }: { value: number; bold?: boolean }) {
  const positive = value >= 0;
  return (
    <div className={`rounded-md px-2 py-1 ${positive ? "bg-green-500/10" : "bg-destructive/10"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
        <span className={`text-[10px] leading-tight text-muted-foreground sm:text-xs sm:text-foreground ${bold ? "font-medium" : ""}`}>{positive ? "Foyda" : "Zarar"}</span>
        <span className={`text-xs font-mono tabular-nums whitespace-nowrap shrink-0 sm:ml-1 ${bold ? "font-semibold" : ""} ${positive ? "text-green-500" : "text-destructive"}`}>
          {positive ? "+" : "−"}{formatCurrency(Math.abs(value))}
        </span>
      </div>
    </div>
  );
}
