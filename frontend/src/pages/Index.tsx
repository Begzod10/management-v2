import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BranchFinanceCard } from "@/components/dashboard/BranchFinanceCard";
import { OverviewCard } from "@/components/dashboard/OverviewCard";
import { MonthPicker } from "@/components/dashboard/MonthPicker";
import type { MonthPickerMode } from "@/components/dashboard/MonthPicker";
import { apiFetch } from "@/lib/api";
import { useInstitution } from "@/contexts/InstitutionContext";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Branch { id: number; name: string; }

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonthValue(date: Date) {
  return formatDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonthValue(date: Date) {
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

const Index = () => {
  const now = new Date();
  const [from, setFrom] = useState(startOfMonthValue(now));
  const [to, setTo] = useState(endOfMonthValue(now));
  const [periodMode, setPeriodMode] = useState<MonthPickerMode>("month");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const { institution } = useInstitution();

  useEffect(() => {
    setBranchesLoading(true);
    setBranches([]);
    setSelectedBranchId("all");
    apiFetch(`/${institution}/branches`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
  }, [institution]);

  const visibleBranches =
    selectedBranchId === "all"
      ? branches
      : branches.filter((b) => String(b.id) === selectedBranchId);
  const effectiveRange = periodMode === "month" ? monthRangeFromValue(from) : { from, to };

  const handleFromChange = (value: string) => {
    setFrom(value);
    if (value && to && value > to) setTo(value);
  };

  const handleToChange = (value: string) => {
    setTo(value);
    if (value && from && value < from) setFrom(value);
  };

  const branchSelect = (
    <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={branchesLoading}>
      <SelectTrigger className="w-44 h-8 text-xs">
        {branchesLoading ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Yuklanmoqda...
          </span>
        ) : (
          <SelectValue placeholder="Filial tanlang" />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Barcha filiallar</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <DashboardLayout
      title="Dashboard"
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          {branchSelect}
          <MonthPicker
            from={effectiveRange.from}
            to={effectiveRange.to}
            mode={periodMode}
            onModeChange={setPeriodMode}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
          />
        </div>
      }
    >
      <div className="space-y-6">
        <OverviewCard
          from={effectiveRange.from}
          to={effectiveRange.to}
          gennisLocationId={institution === "gennis" && selectedBranchId !== "all" ? selectedBranchId : undefined}
          turonBranchId={institution === "turon" && selectedBranchId !== "all" ? selectedBranchId : undefined}
        />

        <div>
        <p className="text-sm font-medium text-muted-foreground mb-3">Filiallar</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleBranches.map((branch) => (
            <BranchFinanceCard
              key={branch.id}
              branchId={String(branch.id)}
              branchName={branch.name}
              from={effectiveRange.from}
              to={effectiveRange.to}
              periodMode={periodMode}
            />
          ))}
          {!branchesLoading && visibleBranches.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2">Filiallar topilmadi</p>
          )}
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
