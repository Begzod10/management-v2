import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MonthPicker } from "@/components/dashboard/MonthPicker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

type PaymentStatus = "unpaid" | "partial" | "paid";

interface OverheadPayment {
  id: number;
  payment_type_id: number | null;
  payment_type_name: string | null;
  overhead_id: number | null;
  amount: number;
  paid_date: string | null;
  note: string | null;
}

interface OverheadItem {
  id: number;
  item_name: string;
  item_sum: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: PaymentStatus;
  payments: OverheadPayment[];
  paid_date: string | null;
  month?: string;
  payment_type: string;
}

interface OverheadData {
  overhead_list: OverheadItem[];
  total_gaz: number;
  total_svet: number;
  total_suv: number;
  total_arenda: number;
  total_other: number;
  paid_sum: number;
  remaining_sum: number;
}

interface Category { key: keyof Pick<OverheadData, "total_gaz" | "total_svet" | "total_suv" | "total_arenda" | "total_other">; label: string; }

const CATEGORIES: Category[] = [
  { key: "total_arenda", label: "Arenda" },
  { key: "total_gaz",    label: "Gaz" },
  { key: "total_suv",    label: "Suv" },
  { key: "total_svet",   label: "Svet" },
  { key: "total_other",  label: "Boshqa Xarajatlar" },
];

type View = "categories" | "detail" | "all";

const emptyData = (): OverheadData => ({
  overhead_list: [],
  total_gaz: 0,
  total_svet: 0,
  total_suv: 0,
  total_arenda: 0,
  total_other: 0,
  paid_sum: 0,
  remaining_sum: 0,
});

const toNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeStatus = (value: unknown, paidAmount: number, cost: number): PaymentStatus => {
  if (value === "unpaid" || value === "partial" || value === "paid") return value;
  if (cost > 0 && paidAmount >= cost) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
};

const getItemName = (row: Record<string, any>) =>
  row.item_name ?? row.overhead_type_name ?? row.overhead_type?.name ?? row.name ?? `Xarajat #${row.id}`;

const categoryKeyForName = (name: string): Category["key"] => {
  const value = name.toLowerCase();
  if (value.includes("arenda")) return "total_arenda";
  if (value.includes("gaz")) return "total_gaz";
  if (value.includes("suv")) return "total_suv";
  if (value.includes("svet")) return "total_svet";
  return "total_other";
};

const normalizePayment = (payment: Record<string, any>): OverheadPayment => ({
  id: toNumber(payment.id),
  payment_type_id: payment.payment_type_id == null ? null : toNumber(payment.payment_type_id),
  payment_type_name: payment.payment_type_name ?? payment.payment_type?.name ?? payment.payment_type ?? null,
  overhead_id: payment.overhead_id == null ? null : toNumber(payment.overhead_id),
  amount: toNumber(payment.amount),
  paid_date: payment.paid_date ?? payment.date ?? null,
  note: payment.note ?? null,
});

const paymentTypeLabel = (payments: OverheadPayment[], fallback?: unknown) => {
  const names = payments
    .map((payment) => payment.payment_type_name)
    .filter(Boolean) as string[];
  if (names.length > 0) return Array.from(new Set(names)).join(", ");
  return typeof fallback === "string" && fallback ? fallback : "-";
};

const normalizeManagementOverheads = (res: any): OverheadData => {
  const rows = Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res?.overhead_list)
      ? res.overhead_list
      : [];
  const normalized = emptyData();

  normalized.overhead_list = rows.map((row: Record<string, any>) => {
    const cost = toNumber(row.cost ?? row.item_sum ?? row.amount);
    const paidAmount = toNumber(row.paid_amount ?? (row.is_paid ? cost : 0));
    const remainingAmount = toNumber(row.remaining_amount ?? Math.max(0, cost - paidAmount));
    const payments = Array.isArray(row.payments) ? row.payments.map(normalizePayment) : [];
    const itemName = getItemName(row);

    normalized[categoryKeyForName(itemName)] += cost;
    normalized.paid_sum += paidAmount;
    normalized.remaining_sum += remainingAmount;

    return {
      id: toNumber(row.id),
      item_name: itemName,
      item_sum: cost,
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      payment_status: normalizeStatus(row.payment_status, paidAmount, cost),
      payments,
      paid_date: row.paid_date ?? null,
      month: row.month,
      payment_type: paymentTypeLabel(payments, row.payment_type),
    };
  });

  normalized.paid_sum = toNumber(res?.summary?.paid_sum ?? normalized.paid_sum);
  normalized.remaining_sum = normalized.overhead_list.reduce((sum, item) => sum + item.remaining_amount, 0);

  return normalized;
};

const getStatusLabel = (status: PaymentStatus) => {
  if (status === "paid") return "To'langan";
  if (status === "partial") return "Qisman";
  return "To'lanmagan";
};

const getStatusVariant = (status: PaymentStatus) => {
  if (status === "paid") return "default";
  if (status === "partial") return "secondary";
  return "outline";
};

function PaymentProgress({ item }: { item: OverheadItem }) {
  const progress = item.item_sum > 0 ? Math.min(100, Math.round((item.paid_amount / item.item_sum) * 100)) : 0;

  return (
    <div className="min-w-36 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={getStatusVariant(item.payment_status)} className="whitespace-nowrap">
          {getStatusLabel(item.payment_status)}
        </Badge>
        <span className="text-xs text-muted-foreground">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

export default function OverheadsPage() {
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
  const [data, setData] = useState<OverheadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("categories");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

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
    setData(null);
    const branchParam = institution === "turon" ? "branch_id" : "location_id";
    apiFetch(`/overhead-type-logs/${month + 1}/${year}?${branchParam}=${selectedBranch}`)
      .then((r) => r.ok ? r.json() : null)
      .then((res) => { if (res) setData(normalizeManagementOverheads(res)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedBranch, month, year, institution]);

  const totalOverhead = CATEGORIES.reduce((s, c) => s + (data?.[c.key] ?? 0), 0);

  const filterExtra = (
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
  );

  // ── Categories view ──────────────────────────────────────────────
  if (view === "categories") {
    return (
      <DashboardLayout
        title="Xarajat Kategoriyalarini Tanlang"
        headerExtra={filterExtra}
      >
        <div className="space-y-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CATEGORIES.map((cat) => (
                <Card
                  key={cat.key}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => { setSelectedCategory(cat); setView("detail"); }}
                >
                  <CardContent className="p-5">
                    <div className="mb-3 pb-3 border-b">
                      <h3 className="font-semibold text-sm">{cat.label}</h3>
                    </div>
                    <div className="bg-muted/50 rounded-md p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">Umumiy Xarajat</p>
                      <p className="text-sm font-bold">{formatCurrency(data?.[cat.key] ?? 0)} UZS</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!loading && data && (
            <Button className="w-full" onClick={() => setView("all")}>
              Umumiy Ma'lumotlarni Ko'rish
            </Button>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ── Category detail view ─────────────────────────────────────────
  if (view === "detail" && selectedCategory) {
    const rows = data?.overhead_list.filter((item) => {
      return categoryKeyForName(item.item_name) === selectedCategory.key;
    }) ?? [];

    return (
      <DashboardLayout
        title={selectedCategory.label}
        headerExtra={filterExtra}
      >
        <div className="space-y-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Umumiy Xarajat Summasi</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.[selectedCategory.key] ?? 0)} UZS</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <div className="px-4 pt-4 pb-2">
                <p className="text-sm font-semibold">Xarajat Tafsiloti</p>
              </div>
              <div className="overflow-auto max-h-[560px]">
              <Table className="min-w-[520px]">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Xarajat nomi</TableHead>
                    <TableHead className="text-center">To'lov turi</TableHead>
                    <TableHead className="text-right">Umumiy Xarajat</TableHead>
                    <TableHead className="text-right">To'langan</TableHead>
                    <TableHead className="text-right">Qoldiq</TableHead>
                    <TableHead>Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-muted-foreground text-sm">
                        Ma'lumot topilmadi
                      </TableCell>
                    </TableRow>
                  ) : rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.payment_type}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.item_sum)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.paid_amount)} UZS</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.remaining_amount)} UZS</TableCell>
                      <TableCell><PaymentProgress item={item} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ── All overheads view ───────────────────────────────────────────
  return (
    <DashboardLayout
      title="Umumiy Xarajatlar Ma'lumoti"
      headerExtra={filterExtra}
    >
      <div className="space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Umumiy Xarajat</p>
              <p className="text-sm font-bold">{formatCurrency(totalOverhead)} UZS</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">To'langan</p>
              <p className="text-sm font-bold">{formatCurrency(data?.paid_sum ?? 0)} UZS</p>
            </CardContent>
          </Card>
          {CATEGORIES.map((cat) => (
            <Card key={cat.key}>
              <CardContent className="p-4 border-l-2 border-l-primary">
                <p className="text-xs text-muted-foreground mb-1">{cat.label}</p>
                <p className="text-sm font-bold">{formatCurrency(data?.[cat.key] ?? 0)} UZS</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Full table */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-semibold">Xarajat Kategoriyalari</p>
            </div>
            <div className="overflow-auto max-h-[560px]">
            <Table className="min-w-[520px]">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Xarajat nomi</TableHead>
                  <TableHead className="text-center">To'lov turi</TableHead>
                  <TableHead className="text-right">Umumiy Xarajat</TableHead>
                  <TableHead className="text-right">To'langan</TableHead>
                  <TableHead className="text-right">Qoldiq</TableHead>
                  <TableHead>Holat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !data || data.overhead_list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground text-sm">
                      Ma'lumot topilmadi
                    </TableCell>
                  </TableRow>
                ) : data.overhead_list.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{item.payment_type}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.item_sum)} UZS</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.paid_amount)} UZS</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.remaining_amount)} UZS</TableCell>
                    <TableCell><PaymentProgress item={item} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => setView("categories")}>
          Bosh Sahifaga
        </Button>
      </div>
    </DashboardLayout>
  );
}
