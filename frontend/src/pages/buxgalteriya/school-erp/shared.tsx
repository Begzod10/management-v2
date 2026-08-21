import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, Filter, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstitution } from "@/contexts/InstitutionContext";
import {
  AccountantScope,
  Pagination,
  makeAccountantScope,
  useAccountantBranches,
  useAccountantDashboard,
  useAccountantDebts,
  useAccountantOverheads,
  useAccountantPayments,
  useAccountantSalaries,
  useAccountantStudents,
} from "@/lib/accountantApi";

export type SchoolErpSection =
  | "dashboard"
  | "students"
  | "payments"
  | "expenses"
  | "payroll"
  | "debts"
  | "cashbank"
  | "inventory"
  | "documents"
  | "accounting"
  | "reports"
  | "branches"
  | "settings";

export const sectionTitles: Record<SchoolErpSection, string> = {
  dashboard: "Dashboard",
  students: "O'quvchilar",
  payments: "To'lovlar",
  expenses: "Xarajatlar",
  payroll: "Ish haqi",
  debts: "Qarzlar",
  cashbank: "Kassa & Bank",
  inventory: "Inventar",
  documents: "Hujjatlar",
  accounting: "Buxgalteriya",
  reports: "Hisobotlar",
  branches: "Filiallar",
  settings: "Sozlamalar",
};

const money = (value: number | null | undefined) => `${(value ?? 0).toLocaleString("uz-UZ")} so'm`;

const revenueData = [
  { month: "Avg", revenue: 82, expense: 38 },
  { month: "Sen", revenue: 98, expense: 42 },
  { month: "Okt", revenue: 110, expense: 46 },
  { month: "Noy", revenue: 125, expense: 54 },
  { month: "Dek", revenue: 118, expense: 51 },
  { month: "Yan", revenue: 142, expense: 62 },
];

const studentRows = [
  ["Holmatov Bekzod", "8-A", "850,000", "15%", "Faol", "Ko'rish"],
  ["Karimova Feruza", "10-B", "1,200,000", "0%", "Faol", "Ko'rish"],
  ["Aliyev Ibrohim", "7-C", "425,000", "50%", "Qisman", "Ko'rish"],
  ["Yusupova Malika", "9-A", "900,000", "0%", "Faol", "Ko'rish"],
  ["Sobirov Javohir", "6-B", "0", "0%", "Qarzdor", "Ko'rish"],
  ["Nazarova Kamola", "9-C", "450,000", "10%", "Qarzdor", "Ko'rish"],
];

const paymentRows = [
  ["#INV-2501", "Holmatov Bekzod", "850,000", "Click", "19-yan", "Oy to'lovi", "To'landi", "PDF"],
  ["#INV-2502", "Karimova Feruza", "1,200,000", "Payme", "18-yan", "Oy to'lovi", "To'landi", "PDF"],
  ["#INV-2503", "Aliyev Ibrohim", "425,000", "Naqd", "17-yan", "Qisman to'lov", "Qisman", "PDF"],
  ["#INV-2504", "Yusupova Malika", "900,000", "Bank", "16-yan", "Oy to'lovi", "To'landi", "PDF"],
];

const expenseRows = [
  ["Yanvar ijarasi", "Ijara", "15,000,000", "Chilonzor", "1-yan", "Bank o'tkazma"],
  ["Elektr energiya", "Kommunal", "4,200,000", "Barcha", "5-yan", "Naqd"],
  ["Darslik va kitoblar", "O'quv materiali", "6,800,000", "Yunusobod", "8-yan", "Click"],
  ["Internet & IT", "Texnologiya", "1,500,000", "Barcha", "10-yan", "Bank o'tkazma"],
  ["Tozalash xizmati", "Xizmatlar", "2,100,000", "Chilonzor", "15-yan", "Naqd"],
];

const payrollRows = [
  ["Yusupov Akbar", "Matematika o'qituvchisi", "148", "50,000/soat", "7,400,000", "+800,000", "8,200,000", "Kutilmoqda"],
  ["Rahimova Dilnoza", "Ingliz tili o'qituvchisi", "136", "45,000/soat", "6,120,000", "-", "6,120,000", "Kutilmoqda"],
  ["Qodirov Nodir", "Fizika o'qituvchisi", "144", "48,000/soat", "6,912,000", "+500,000", "7,412,000", "Kutilmoqda"],
  ["Nazarova Hulkar", "Kimyo o'qituvchisi", "120", "46,000/soat", "5,520,000", "-", "5,520,000", "Kutilmoqda"],
  ["Mirzayev Zafar", "Direktor o'rinbosari", "168", "70,000/soat", "11,760,000", "+2,000,000", "13,760,000", "Kutilmoqda"],
];

const cashBankRows = [
  ["19-yan", "Holmatov Bekzod to'lovi", "O'quvchi to'lovi", "Bank", "850,000", "-", "288,250,000"],
  ["19-yan", "Kommunal to'lov", "Xarajat", "Kassa", "-", "320,000", "33,800,000"],
  ["18-yan", "Karimova Feruza to'lovi", "O'quvchi to'lovi", "Bank", "1,200,000", "-", "287,400,000"],
  ["18-yan", "O'qituvchi ish haqi avans", "Ish haqi", "Bank", "-", "3,500,000", "286,200,000"],
  ["17-yan", "Ijara to'lovi", "Ijara", "Bank", "-", "15,000,000", "289,700,000"],
];

const inventoryRows = [
  ["Daftarlar", "500", "480", "20"],
  ["Ruchkalar", "1000", "870", "130"],
  ["Rangli qog'oz", "200", "180", "20 (kam!)"],
  ["Markerlar", "100", "95", "5 (kam!)"],
  ["Printer qog'ozi (A4)", "50 paket", "38", "12 paket"],
];

function StatusBadge({ value }: { value: string }) {
  const variant = value === "Faol" || value === "To'landi" || value === "Aktiv" ? "default" : "secondary";
  return <Badge variant={variant}>{value}</Badge>;
}

export function SchoolErpKpiCard({
  title,
  value,
  hint,
  tone = "blue",
  onClick,
}: {
  title: string;
  value: string;
  hint: string;
  tone?: "blue" | "green" | "amber" | "red";
  onClick?: () => void;
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
  };
  return (
    <Card className={cn("border", tones[tone], onClick && "cursor-pointer transition-colors hover:border-primary/50")} onClick={onClick}>
      <CardContent className="p-4">
        <div className="text-xs font-medium opacity-80">{title}</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs opacity-70">{hint}</div>
      </CardContent>
    </Card>
  );
}

type ChartPoint = { month: string; revenue?: number; expense?: number };

const chartValue = (value: number) => `${value.toLocaleString("uz-UZ")} so'm`;
const chartAxisValue = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
};
const chartLabel = (name: string) => ({ revenue: "Kirim", expense: "Xarajat" }[name] ?? name);

export function SchoolErpChart({ type = "area", data = revenueData }: { type?: "area" | "bar" | "line"; data?: ChartPoint[] }) {
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={chartAxisValue} width={60} />
            <Tooltip formatter={(value, name) => [chartValue(Number(value)), chartLabel(String(name))]} />
            <Bar dataKey="revenue" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expense" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={chartAxisValue} width={60} />
            <Tooltip formatter={(value, name) => [chartValue(Number(value)), chartLabel(String(name))]} />
            <Line dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} dot={false} />
            <Line dataKey="expense" stroke="#ef4444" strokeWidth={3} dot={false} />
          </LineChart>
        ) : (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={chartAxisValue} width={60} />
            <Tooltip formatter={(value, name) => [chartValue(Number(value)), chartLabel(String(name))]} />
            <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.18} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function SchoolErpTable({
  rows,
  headers,
  onRowClick,
  bodyHeightClass = "max-h-[calc(100vh-450px)]",
}: {
  headers: string[];
  rows: string[][];
  onRowClick?: (row: string[]) => void;
  bodyHeightClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="block table-fixed min-w-[560px]">
            <TableHeader className="block bg-card">
              <TableRow className="table w-full table-fixed hover:bg-transparent">
                {headers.map((h) => <TableHead key={h} className="border-b bg-card">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody className={cn("block overflow-y-auto", bodyHeightClass)}>
              {rows.map((row) => (
                <TableRow
                  key={row.join("-")}
                  onClick={() => onRowClick?.(row)}
                  className={cn("table w-full table-fixed", onRowClick && "cursor-pointer")}
                >
                  {row.map((cell, index) => (
                    <TableCell key={`${cell}-${index}`}>
                      {["Faol", "To'landi", "Aktiv", "Qisman", "Qarzdor", "Kutilmoqda", "Kechikkan", "Yopildi", "Tugadi", "Imzolangan"].includes(cell)
                        ? <StatusBadge value={cell} />
                        : ["PDF", "Ko'rish", "Ulash"].includes(cell)
                          ? <Button variant="outline" size="sm" onClick={(event) => event.stopPropagation()}>{cell}</Button>
                          : cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TablePagination({
  pagination,
  onOffsetChange,
}: {
  pagination?: Pagination;
  onOffsetChange: (offset: number) => void;
}) {
  if (!pagination) return null;

  const page = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const from = pagination.total === 0 ? 0 : pagination.offset + 1;
  const to = Math.min(pagination.offset + pagination.limit, pagination.total);
  const prevOffset = Math.max(0, pagination.offset - pagination.limit);
  const nextOffset = pagination.offset + pagination.limit;

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        {from}-{to} / {pagination.total}
      </div>
      <div className="flex items-center gap-2">
        <span>{page} / {totalPages}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.offset <= 0}
          onClick={() => onOffsetChange(prevOffset)}
        >
          Oldingi
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!pagination.has_more}
          onClick={() => onOffsetChange(nextOffset)}
        >
          Keyingi
        </Button>
      </div>
    </div>
  );
}

function DataState({ loading, error, empty }: { loading?: boolean; error?: unknown; empty?: string }) {
  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-md border text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Ma'lumotlar yuklanmoqda
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Ma'lumotlarni yuklashda xatolik yuz berdi"}
      </div>
    );
  }
  if (empty) {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground">{empty}</div>;
  }
  return null;
}

function ContentLoader({ cards = 4, chart = true, tabs = false }: { cards?: number; chart?: boolean; tabs?: boolean }) {
  return (
    <div className="space-y-4">
      {tabs && (
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      )}
      {cards > 0 && (
        <div className={cn("grid grid-cols-2 gap-3", cards === 3 ? "md:grid-cols-3" : "md:grid-cols-4")}>
          {Array.from({ length: cards }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {chart && (
        <Card>
          <CardHeader><Skeleton className="h-6 w-44" /></CardHeader>
          <CardContent><Skeleton className="h-60 w-full" /></CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.join("-")}>
            {row.map((cell, index) => <TableCell key={`${cell}-${index}`}>{cell}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const dateShort = (value?: string | null) => value ? value.slice(0, 10) : "-";
const dateTime = (value?: string | null) => value ? new Date(value).getTime() || 0 : 0;
const inputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const defaultDateRange = () => {
  const now = new Date();
  return {
    from: inputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: inputDate(now),
  };
};
const compareDateDesc = (a?: string | null, b?: string | null) => {
  const aTime = dateTime(a);
  const bTime = dateTime(b);
  if (aTime && bTime) return bTime - aTime;
  if (aTime) return -1;
  if (bTime) return 1;
  return 0;
};
const TABLE_LIMIT = 50;
const FilterPortalContext = createContext<HTMLElement | null>(null);

function FilterBar({ children }: { children: ReactNode }) {
  const target = useContext(FilterPortalContext);
  const content = (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-fit">
          <Filter className="mr-2 h-4 w-4" />
          Filtrlar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Filtrlar</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
  return target ? createPortal(content, target) : content;
}

function ActionDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const titles: Record<string, string> = {
    notifications: "Bildirishnomalar",
    payment: "To'lov qabul qilish",
    qr: "QR Kod orqali to'lov",
    student: "Yangi o'quvchi qo'shish",
    studentDetail: "O'quvchi profili - Holmatov Bekzod",
    report: "Sinov balansi - Yanvar 2025",
    expense: "Xarajat qo'shish",
    debt: "Qarz qo'shish",
    txn: "Kassa/Bank operatsiyasi",
  };
  const title = id ? titles[id] ?? "Yangi yozuv" : "Yangi yozuv";
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {id === "notifications" && (
          <div className="space-y-2 text-sm">
            {["3 ta to'lov muddati o'tdi", "Yangi Click to'lovi qabul qilindi", "Ijara to'lovi 5 kundan keyin", "Kassa limiti tekshirilsin"].map((text) => (
              <div key={text} className="rounded-md border p-3">{text}</div>
            ))}
          </div>
        )}
        {id === "qr" && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="grid grid-cols-12 gap-1 rounded-lg border bg-muted p-3">
              {Array.from({ length: 144 }).map((_, i) => (
                <div key={i} className={cn("h-2 w-2 rounded-[1px]", (i * 7 + i) % 5 < 2 ? "bg-foreground" : "bg-background")} />
              ))}
            </div>
            <div className="text-center text-sm text-muted-foreground">Click / Payme orqali to'lov uchun QR kod</div>
            <div className="flex gap-2"><Button variant="outline">Ulash</Button><Button>Yuklab olish</Button></div>
          </div>
        )}
        {id === "studentDetail" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="font-semibold">Holmatov Bekzod</div>
              <div className="text-sm text-muted-foreground">8-A sinf - Chilonzor filiali - 15% chegirma</div>
            </div>
            <SchoolErpTable
              headers={["Oy", "Summa", "Kanal", "Status"]}
              rows={[
                ["Yanvar 2025", "850,000", "Click", "To'landi"],
                ["Dekabr 2024", "850,000", "Payme", "To'landi"],
                ["Noyabr 2024", "850,000", "Naqd", "To'landi"],
              ]}
            />
          </div>
        )}
        {id === "report" && (
          <SchoolErpTable
            headers={["Hisob", "Nomi", "Debet", "Kredit"]}
            rows={[
              ["1010", "Kassa", "34,120,000", "-"],
              ["1020", "Bank", "287,400,000", "-"],
              ["1200", "Debitorlik qarzi", "58,700,000", "-"],
              ["1600", "Asosiy vositalar", "242,300,000", "-"],
              ["6010", "Kreditorlik qarzi", "-", "12,400,000"],
              ["6600", "Bank krediti", "-", "150,000,000"],
              ["9010", "Daromad", "-", "350,700,000"],
              ["2010", "Ish haqi xarajati", "68,400,000", "-"],
              ["2020", "Ijara", "45,000,000", "-"],
            ]}
          />
        )}
        {!["notifications", "qr", "studentDetail", "report"].includes(id ?? "") && (
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{id === "student" ? "O'quvchi" : id === "expense" ? "Xarajat turi" : id === "debt" ? "Qarz oluvchi" : "Nomi"}</Label>
              <Input placeholder="Ma'lumot kiriting" />
            </div>
            <div className="grid gap-1.5">
              <Label>Summa / qiymat</Label>
              <Input placeholder="850000" />
            </div>
            <div className="grid gap-1.5">
              <Label>To'lov usuli</Label>
              <Select defaultValue="cash">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Naqd</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="click">Click</SelectItem>
                  <SelectItem value="payme">Payme</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bekor qilish</Button>
          <Button onClick={onClose}>{id === "payment" ? "To'lovni qabul qilish" : id === "report" ? "PDF yuklab olish" : "Saqlash"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SchoolErpPageShell({
  section,
  children,
  actionType = "payment",
  showCreateButton = true,
}: {
  section: SchoolErpSection;
  children: (openModal: (id: string) => void, scope: AccountantScope | null) => ReactNode;
  actionType?: string;
  showCreateButton?: boolean;
}) {
  const [modal, setModal] = useState<string | null>(null);
  const [filterPortalTarget, setFilterPortalTarget] = useState<HTMLDivElement | null>(null);
  const { institution } = useInstitution();
  const { data: branches = [], isLoading: branchesLoading } = useAccountantBranches(institution);
  const storageKey = `accountant:${institution}:scope`;
  const [selectedBranchId, setSelectedBranchId] = useState(() => localStorage.getItem(storageKey) ?? "");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) ?? "";
    setSelectedBranchId(saved);
  }, [storageKey]);

  useEffect(() => {
    if (branches.length === 0) return;
    const hasSelected = branches.some((branch) => String(branch.id) === selectedBranchId);
    if (!hasSelected) {
      const nextId = String(branches[0].id);
      setSelectedBranchId(nextId);
      localStorage.setItem(storageKey, nextId);
    }
  }, [branches, selectedBranchId, storageKey]);

  const scope = useMemo(() => {
    const id = Number(selectedBranchId);
    return Number.isFinite(id) && id > 0 ? makeAccountantScope(institution, id) : null;
  }, [institution, selectedBranchId]);

  return (
    <DashboardLayout
      title={sectionTitles[section]}
      headerExtra={
        <div className="flex items-center gap-2">
          <div ref={setFilterPortalTarget} className="flex items-center" />
          <Select
            value={selectedBranchId}
            onValueChange={(value) => {
              setSelectedBranchId(value);
              localStorage.setItem(storageKey, value);
            }}
            disabled={branchesLoading || branches.length === 0}
          >
            <SelectTrigger className="h-9 w-[110px] sm:w-[180px]">
              <SelectValue placeholder={branchesLoading ? "..." : "Filial"} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={String(branch.id)}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{sectionTitles[section]}</h2>
            <p className="text-sm text-muted-foreground">Buxgalteriya bo'limi uchun alohida sahifa</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            {showCreateButton && (
              <Button onClick={() => setModal(actionType)}>
                <Plus className="mr-1 h-4 w-4" />
                Yangi yozuv
              </Button>
            )}
          </div>
        </div>
        <FilterPortalContext.Provider value={filterPortalTarget}>
          {children(setModal, scope)}
        </FilterPortalContext.Provider>
      </div>
      <ActionDialog id={modal} onClose={() => setModal(null)} />
    </DashboardLayout>
  );
}

export function DashboardContent({ openModal, scope }: { openModal: (id: string) => void; scope?: AccountantScope | null }) {
  const navigate = useNavigate();
  const [from, setFrom] = useState(() => defaultDateRange().from);
  const [to, setTo] = useState(() => defaultDateRange().to);
  const dashboardFilters = { from, to };
  const { data, isLoading, error } = useAccountantDashboard(scope ?? null, dashboardFilters);
  const chartData = data?.trend.map((point) => ({
    month: point.label,
    revenue: point.income,
  }));
  const paymentRows = [...(data?.recent_payments ?? [])].sort((a, b) => compareDateDesc(a.date, b.date) || b.amount - a.amount).map((item) => [
    `#INV-${item.id}`,
    item.student_name,
    money(item.amount),
    item.channel ?? "-",
    dateShort(item.date),
    item.type,
    item.status,
  ]);

  if (!scope) return <DataState empty="Filial tanlang" />;
  if (isLoading) return <ContentLoader cards={4} chart />;
  if (error) return <DataState error={error} />;

  return (
    <div className="space-y-4">
      <FilterBar>
        <Input className="h-9 w-full" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input className="h-9 w-full" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </FilterBar>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SchoolErpKpiCard title="Bugungi to'lovlar" value={money(data?.today_payments.value)} hint={`Kecha ${money(data?.today_payments.yesterday_value)}`} onClick={() => navigate("/buxgalteriya/payments")} />
        <SchoolErpKpiCard title="Oylik kirim" value={money(data?.monthly_income.value)} hint={data?.monthly_income.month_label ?? ""} tone="green" />
        <SchoolErpKpiCard title="Qarzdorlik" value={money(data?.debt.value)} hint={`${data?.debt.open_count ?? 0} ta ochiq qarz`} tone="amber" onClick={() => navigate("/buxgalteriya/debts")} />
        <SchoolErpKpiCard title="Xarajatlar" value={money(data?.today_expenses.value)} hint={`Ish haqi ${money(data?.today_expenses.salaries)}`} tone="red" onClick={() => navigate("/buxgalteriya/expenses")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Kirim dinamikasi</CardTitle>
          </CardHeader>
          <CardContent><SchoolErpChart data={chartData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tezkor ogohlar</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border p-3">3 ta o'quvchi to'lovi kechikkan</div>
            <div className="rounded-md border p-3">Ijara to'lovi 5 kundan keyin</div>
            <div className="rounded-md border p-3">Naqd kassa limiti tekshirilsin</div>
          </CardContent>
        </Card>
      </div>
      <SchoolErpTable headers={["ID", "O'quvchi", "Summa", "Kanal", "Sana", "Tur", "Holat"]} rows={paymentRows} />
    </div>
  );
}

export function StudentsContent({ scope }: { openModal: (id: string) => void; scope?: AccountantScope | null }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "partial" | "debtor">("all");
  const { data, isLoading, error } = useAccountantStudents(scope ?? null, { limit: TABLE_LIMIT, offset, search, status });
  const sortedStudents = [...(data?.students ?? [])].sort((a, b) => {
    const aOwes = a.remaining_debt > 0;
    const bOwes = b.remaining_debt > 0;
    if (aOwes !== bOwes) return aOwes ? -1 : 1;

    if (aOwes && bOwes) return b.remaining_debt - a.remaining_debt;
    return Math.abs(b.monthly) - Math.abs(a.monthly);
  });
  const rows = sortedStudents.map((student) => [
    student.name,
    student.class_label ?? "-",
    money(student.monthly),
    money(student.payment),
    money(student.remaining_debt),
    money(student.discount),
    student.status === "active" ? "Faol" : student.status === "partial" ? "Qisman" : "Qarzdor",
  ]) ?? [];

  if (!scope) return <DataState empty="Filial tanlang" />;
  if (isLoading) return <ContentLoader cards={4} chart={false} />;
  if (error) return <DataState error={error} />;

  return (
    <div className="space-y-4">
      <FilterBar>
        <Input
          className="h-9 w-[240px]"
          placeholder="Qidirish"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
        />
        <Select value={status} onValueChange={(value) => {
          setStatus(value as "all" | "active" | "partial" | "debtor");
          setOffset(0);
        }}>
          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Hammasi</SelectItem>
            <SelectItem value="active">Faol</SelectItem>
            <SelectItem value="partial">Qisman</SelectItem>
            <SelectItem value="debtor">Qarzdor</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SchoolErpKpiCard title="O'quvchilar" value={String(data?.totals.count ?? 0)} hint="Filtr bo'yicha" />
        <SchoolErpKpiCard title="Oylik" value={money(data?.totals.monthly)} hint="Hisoblangan" tone="green" />
        <SchoolErpKpiCard title="To'langan" value={money(data?.totals.payment)} hint="Jami" tone="green" />
        <SchoolErpKpiCard title="Qolgan" value={money(data?.totals.remaining_debt)} hint={`${data?.totals.debtor ?? 0} qarzdor`} tone="amber" />
      </div>
      <SchoolErpTable headers={["F.I.Sh", "Sinf", "Oylik", "To'langan", "Qolgan", "Chegirma", "Holat"]} rows={rows} />
      <TablePagination pagination={data?.pagination} onOffsetChange={setOffset} />
    </div>
  );
}

export function PaymentsContent({ openModal, scope }: { openModal: (id: string) => void; scope?: AccountantScope | null }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [type, setType] = useState<"all" | "payment" | "discount">("all");
  const [from, setFrom] = useState(() => defaultDateRange().from);
  const [to, setTo] = useState(() => defaultDateRange().to);
  const { data, isLoading, error } = useAccountantPayments(scope ?? null, {
    limit: TABLE_LIMIT,
    offset,
    search,
    channel: channel === "all" ? undefined : channel,
    type: type === "all" ? undefined : type,
    from,
    to,
  });
  const chartData = data?.trend.map((point) => ({
    month: point.label,
    revenue: point.revenue,
    expense: point.expense,
  }));
  const rows = [...(data?.items ?? [])].sort((a, b) => compareDateDesc(a.date, b.date) || b.amount - a.amount).map((item) => [
    item.code,
    item.student_name,
    money(item.amount),
    item.channel_label ?? item.channel ?? "-",
    item.date_label,
    item.type,
    item.status,
  ]);

  if (!scope) return <DataState empty="Filial tanlang" />;
  if (isLoading) return <ContentLoader cards={4} chart />;
  if (error) return <DataState error={error} />;

  return (
    <div className="space-y-4">
      <FilterBar>
        <Input className="h-9 w-full" placeholder="O'quvchi" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} />
        <Select value={channel} onValueChange={(value) => { setChannel(value); setOffset(0); }}>
          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kanal</SelectItem>
            <SelectItem value="cash">Naqd</SelectItem>
            <SelectItem value="click">Click</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="payme">Payme</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(value) => { setType(value as "all" | "payment" | "discount"); setOffset(0); }}>
          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tur</SelectItem>
            <SelectItem value="payment">To'lov</SelectItem>
            <SelectItem value="discount">Chegirma</SelectItem>
          </SelectContent>
        </Select>
        <Input className="h-9 w-full" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} />
        <Input className="h-9 w-full" type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} />
      </FilterBar>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SchoolErpKpiCard title="Jami" value={money(data?.month_total)} hint={`${data?.month ?? ""}/${data?.year ?? ""}`} tone="green" />
        {(data?.totals_by_channel ?? []).map((channel, index) => (
          <SchoolErpKpiCard
            key={channel.channel}
            title={channel.label}
            value={money(channel.value)}
            hint={`${channel.percent}%`}
            tone={index === 1 ? "green" : index === 2 ? "amber" : "blue"}
          />
        ))}
      </div>
      <Card><CardHeader><CardTitle>To'lov kanallari</CardTitle></CardHeader><CardContent><SchoolErpChart type="bar" data={chartData} /></CardContent></Card>
      <SchoolErpTable headers={["ID", "O'quvchi", "Summa", "Kanal", "Sana", "Tur", "Holat"]} rows={rows} />
      <TablePagination pagination={data?.pagination} onOffsetChange={setOffset} />
    </div>
  );
}

export function DebtsContent({ scope }: { scope?: AccountantScope | null }) {
  const [tab, setTab] = useState<"students" | "given" | "taken">("students");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "settled" | "cancelled">("all");
  const { data, isLoading, error } = useAccountantDebts(scope ?? null, { tab, limit: TABLE_LIMIT, offset, search, status });

  if (!scope) return <DataState empty="Filial tanlang" />;
  if (isLoading) return <ContentLoader cards={0} chart={false} tabs />;
  if (error) return <DataState error={error} />;

  const studentRows = data?.tab === "students"
    ? [...data.rows].sort((a, b) => compareDateDesc(a.last_payment_date, b.last_payment_date) || b.debt_amount - a.debt_amount).map((row) => [
      row.name,
      row.group_label ?? "-",
      money(row.debt_amount),
      `${row.days_overdue} kun`,
      row.discount_status === "active" ? "Aktiv" : row.discount_status === "cancelled" ? "Bekor qilindi" : "Yo'q",
      money(row.discount_amount),
      dateShort(row.last_payment_date),
      row.status === "overdue" ? "Kechikkan" : "Kutilmoqda",
    ])
    : [];
  const loanRows = data?.tab !== "students"
    ? [...data.rows].sort((a, b) => compareDateDesc(a.issued_date, b.issued_date) || b.principal_amount - a.principal_amount).map((row) => [
      row.counterparty,
      money(row.principal_amount),
      dateShort(row.issued_date),
      dateShort(row.due_date),
      row.days_overdue > 0 ? `${row.days_overdue} kun` : "-",
      row.status === "active" ? "Aktiv" : row.status === "overdue" ? "Kechikkan" : row.status === "settled" ? "To'landi" : "Bekor qilingan",
    ])
    : [];

  return (
    <div className="space-y-4">
      {data?.tab === "students" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SchoolErpKpiCard title="Qarzdorlar" value={String(data.totals.count)} hint="O'quvchilar" />
          <SchoolErpKpiCard title="Jami qarz" value={money(data.totals.debt_amount)} hint={`${data.month}/${data.year}`} tone="amber" />
          <SchoolErpKpiCard title="Kechikkan" value={String(data.totals.overdue_count)} hint="overdue" tone="red" />
          <SchoolErpKpiCard title="Kutilmoqda" value={String(data.totals.pending_count)} hint="pending" tone="green" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SchoolErpKpiCard title="Qarzlar" value={String(data?.totals.count ?? 0)} hint={tab === "given" ? "Berilgan" : "Olingan"} />
          <SchoolErpKpiCard title="Jami summa" value={money(data?.totals.principal_total)} hint="Principal" tone="amber" />
          <SchoolErpKpiCard title="Aktiv" value={money(data?.totals.active_total)} hint="Aktiv qarzlar" tone="red" />
          <SchoolErpKpiCard title="Yopilgan" value={money(data?.totals.settled_total)} hint="To'langan" tone="green" />
        </div>
      )}
      <Tabs value={tab} onValueChange={(value) => {
        setTab(value as "students" | "given" | "taken");
        setOffset(0);
      }}>
        <div className="overflow-x-auto">
        <TabsList className="w-max">
          <TabsTrigger value="students">O'quvchi qarzlari</TabsTrigger>
          <TabsTrigger value="given">Berilgan qarzlar</TabsTrigger>
          <TabsTrigger value="taken">Olingan qarzlar</TabsTrigger>
        </TabsList>
      </div>
        <FilterBar>
          <Input className="h-9 w-full" placeholder="Qidirish" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} />
          {tab !== "students" && (
            <Select value={status} onValueChange={(value) => { setStatus(value as "all" | "active" | "settled" | "cancelled"); setOffset(0); }}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="settled">To'langan</SelectItem>
                <SelectItem value="cancelled">Bekor qilingan</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FilterBar>
        <TabsContent value="students"><SchoolErpTable bodyHeightClass="max-h-[calc(100vh-470px)]" headers={["O'quvchi", "Guruh", "Qarz miqdori", "Kechikkan kunlar", "Chegirma holati", "Chegirma", "Oxirgi to'lov", "Status"]} rows={studentRows} /></TabsContent>
        <TabsContent value="given"><SchoolErpTable bodyHeightClass="max-h-[calc(100vh-470px)]" headers={["Qarz oluvchi", "Summa", "Sana", "Qaytarish sanasi", "Kechikkan", "Status"]} rows={loanRows} /></TabsContent>
        <TabsContent value="taken"><SchoolErpTable bodyHeightClass="max-h-[calc(100vh-470px)]" headers={["Qarz beruvchi", "Summa", "Sana", "Qaytarish sanasi", "Kechikkan", "Status"]} rows={loanRows} /></TabsContent>
      </Tabs>
      <TablePagination pagination={data?.pagination} onOffsetChange={setOffset} />
    </div>
  );
}

export function DocumentsContent({ accounting = false }: { accounting?: boolean }) {
  return (
    <Tabs defaultValue="first">
      <div className="overflow-x-auto">
        <TabsList className="w-max">
          <TabsTrigger value="first">{accounting ? "Hisoblar rejasi" : "Shartnomalar"}</TabsTrigger>
          <TabsTrigger value="second">{accounting ? "Bosh kitob" : "Hisob-fakturalar"}</TabsTrigger>
          <TabsTrigger value="third">{accounting ? "Jurnal" : "Aktlar"}</TabsTrigger>
        </TabsList>
      </div>
      {accounting ? (
        <>
          <TabsContent value="first"><SchoolErpTable headers={["Hisob", "Nomi", "Tur", "Saldo", "Holat"]} rows={[["1010", "Kassa", "Aktiv", "34,120,000", "Aktiv"], ["1020", "Bank", "Aktiv", "287,400,000", "Aktiv"], ["1200", "Debitorlik", "Aktiv", "58,700,000", "Aktiv"], ["9010", "Daromad", "Daromad", "350,700,000", "Aktiv"]]} /></TabsContent>
          <TabsContent value="second"><SchoolErpTable headers={["Sana", "Jurnal №", "Tavsif", "Hisob", "Debet", "Kredit", "Qoldiq"]} rows={[["1-yan", "#J001", "Yanvar billing kiritildi", "1200 / 9010", "342,500,000", "-", "342,500,000"], ["5-yan", "#J002", "Ijara to'lovi", "2020 / 1020", "-", "45,000,000", "297,500,000"], ["10-yan", "#J003", "Kommunal xarajat", "2030 / 1010", "-", "12,400,000", "285,100,000"], ["15-yan", "#J004", "O'quvchi to'lovlari", "1010/1020 / 1200", "283,800,000", "-", "568,900,000"], ["20-yan", "#J005", "Ish haqi avans", "2010 / 1020", "-", "34,200,000", "534,700,000"]]} /></TabsContent>
          <TabsContent value="third"><SchoolErpTable headers={["Jurnal №", "Sana", "Tavsif", "Debet hisob", "Kredit hisob", "Summa"]} rows={[["#J001", "01-yan", "Yanvar ta'lim xizmati fakturasi", "1200 - Debitorlik", "9010 - Daromad", "342,500,000"], ["#J002", "05-yan", "Ijara to'lovi Chilonzor", "2020 - Ijara xarajati", "1020 - Bank", "15,000,000"], ["#J003", "10-yan", "Elektr va gaz", "2030 - Kommunal", "1010 - Kassa", "4,200,000"]]} /></TabsContent>
        </>
      ) : (
        <>
          <TabsContent value="first"><SchoolErpTable headers={["Shartnoma №", "O'quvchi / Mijoz", "Tur", "Boshlanish", "Tugash", "Summa", "Holat", "Yuklab olish"]} rows={[["#CTR-2024-001", "Holmatov Bekzod", "Ta'lim xizmati", "01-sen-24", "30-iyn-25", "8,500,000", "Aktiv", "PDF"], ["#CTR-2024-002", "Aliyev Ibrohim", "Ta'lim xizmati", "01-sen-24", "30-iyn-25", "8,500,000", "Aktiv", "PDF"], ["#CTR-2024-050", "Farrux Kompaniyasi", "Ijara shartnomasi", "01-yan-24", "31-dek-24", "180,000,000", "Tugadi", "PDF"]]} /></TabsContent>
          <TabsContent value="second"><SchoolErpTable headers={["Faktura №", "O'quvchi", "Summa", "Sana", "Muddati", "Holat", "Yuklab olish"]} rows={[["#INV-2501", "Holmatov Bekzod", "850,000", "1-yan", "25-yan", "To'landi", "PDF"], ["#INV-2502", "Aliyev Ibrohim", "850,000", "1-yan", "10-yan", "Kechikkan", "PDF"], ["#INV-2503", "Karimova Feruza", "1,200,000", "1-yan", "25-yan", "To'landi", "PDF"]]} /></TabsContent>
          <TabsContent value="third"><SchoolErpTable headers={["Akt №", "Tomon", "Tavsif", "Summa", "Sana", "Holat", "Yuklab olish"]} rows={[["#ACT-2401", "Toshkent servis MChJ", "Kompyuter ta'mirlash ishlari", "3,200,000", "10-yan", "Imzolangan", "PDF"]]} /></TabsContent>
        </>
      )}
    </Tabs>
  );
}

export function ReportsContent({ openModal }: { openModal: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["Trial Balance", "Foyda va Zarar", "Balans", "Cashflow"].map((title) => (
          <Card key={title} className="cursor-pointer hover:border-primary/50" onClick={() => openModal("report")}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">Yanvar 2025 bo'yicha PDF/Excel hisobot.</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Foyda va Zarar - Yanvar 2025 (Qisqacha)</CardTitle></CardHeader>
        <CardContent>
          <SchoolErpTable
            headers={["Ko'rsatkich", "Summa"]}
            rows={[
              ["DAROMADLAR", ""],
              ["Ta'lim xizmati", "342,500,000"],
              ["Boshqa daromadlar", "8,200,000"],
              ["Jami daromad", "350,700,000"],
              ["XARAJATLAR", ""],
              ["Ish haqi", "68,400,000"],
              ["Ijara", "45,000,000"],
              ["Kommunal", "12,400,000"],
              ["Boshqa xarajatlar", "6,700,000"],
              ["Jami xarajat", "132,500,000"],
              ["SOF FOYDA", "218,200,000"],
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function BranchesContent() {
  const [activeBranch, setActiveBranch] = useState("Chilonzor filiali");
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">Aktiv filial: <span className="font-medium text-foreground">{activeBranch}</span></div>
      <div className="grid gap-4 md:grid-cols-3">
      {["Chilonzor filiali", "Yunusobod filiali", "Sergeli filiali"].map((name, index) => (
        <Card key={name} className="cursor-pointer hover:border-primary/50" onClick={() => setActiveBranch(name)}>
          <CardHeader><CardTitle>{name}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Kirim: {money(54_000_000 + index * 7_500_000)}</div>
            <div>O'quvchilar: {48 + index * 12}</div>
            <StatusBadge value="Aktiv" />
          </CardContent>
        </Card>
      ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Telegram bot</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline">Hisobot</Button>
          <Button variant="outline">To'lovlar</Button>
          <Button variant="outline">Ogohlar</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsContent() {
  return (
    <Card>
      <CardHeader><CardTitle>Integratsiyalar</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {["Click", "Payme", "Telegram bot", "PDF eksport"].map((name) => <div key={name} className="rounded-md border p-3 text-sm">{name}: yoqilgan</div>)}
      </CardContent>
    </Card>
  );
}

export function GenericContent({ section, scope }: { section: SchoolErpSection; scope?: AccountantScope | null }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(() => defaultDateRange().from);
  const [to, setTo] = useState(() => defaultDateRange().to);
  const [overheadTypeId, setOverheadTypeId] = useState("");
  const [paymentTypeId, setPaymentTypeId] = useState("");
  const [role, setRole] = useState<"all" | "teacher" | "assistent" | "staff">("all");
  const [salaryStatus, setSalaryStatus] = useState<"all" | "pending" | "partial" | "paid">("all");
  const overheads = useAccountantOverheads(section === "expenses" ? scope ?? null : null, {
    limit: TABLE_LIMIT,
    offset,
    search,
    from,
    to,
    overhead_type_id: overheadTypeId ? Number(overheadTypeId) : undefined,
    payment_type_id: paymentTypeId ? Number(paymentTypeId) : undefined,
  });
  const salaries = useAccountantSalaries(section === "payroll" ? scope ?? null : null, {
    limit: TABLE_LIMIT,
    offset,
    search,
    from,
    to,
    role,
    status: salaryStatus,
  });

  if (section === "expenses") {
    if (!scope) return <DataState empty="Filial tanlang" />;
    if (overheads.isLoading) return <ContentLoader cards={3} chart />;
    if (overheads.error) return <DataState error={overheads.error} />;
    const chartData = overheads.data?.chart.map((point) => ({
      month: point.label,
      revenue: point.revenue,
      expense: point.expense,
    }));
    const categoryRows = overheads.data?.totals.by_category.map((item) => [
      item.category ?? "Boshqa",
      money(item.amount),
    ]) ?? [];
    const paymentTypeRows = overheads.data?.totals.by_payment_type.map((item) => [
      item.payment_type ?? "-",
      money(item.amount),
    ]) ?? [];
    const rows = [...(overheads.data?.overheads ?? [])].sort((a, b) => compareDateDesc(a.date, b.date) || b.amount - a.amount).map((item) => [
      item.name,
      item.category ?? "Boshqa",
      money(item.amount),
      item.branch_name ?? "-",
      dateShort(item.date),
      item.payment_type ?? "-",
    ]);

    return (
      <div className="space-y-4">
        <FilterBar>
          <Input className="h-9 w-full" placeholder="Qidirish" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} />
          <Select value={overheadTypeId || "all"} onValueChange={(value) => { setOverheadTypeId(value === "all" ? "" : value); setOffset(0); }}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kategoriya</SelectItem>
              {(overheads.data?.totals.by_category ?? []).filter((item) => item.category_id !== null).map((item) => (
                <SelectItem key={item.category_id} value={String(item.category_id)}>{item.category ?? "Boshqa"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentTypeId || "all"} onValueChange={(value) => { setPaymentTypeId(value === "all" ? "" : value); setOffset(0); }}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">To'lov usuli</SelectItem>
              {(overheads.data?.totals.by_payment_type ?? []).filter((item) => item.payment_type_id !== null).map((item) => (
                <SelectItem key={item.payment_type_id} value={String(item.payment_type_id)}>{item.payment_type ?? "-"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-9 w-full" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} />
          <Input className="h-9 w-full" type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} />
        </FilterBar>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <SchoolErpKpiCard title="Xarajatlar" value={money(overheads.data?.totals.amount)} hint={`${overheads.data?.totals.count ?? 0} yozuv`} tone="red" />
          <SchoolErpKpiCard title="Kategoriya" value={String(overheads.data?.totals.by_category.length ?? 0)} hint="Turlar soni" />
          <SchoolErpKpiCard title="To'lov usuli" value={String(overheads.data?.totals.by_payment_type.length ?? 0)} hint="Kesimlar" tone="amber" />
        </div>
        <Card><CardHeader><CardTitle>Xarajat kategoriyalari</CardTitle></CardHeader><CardContent><SchoolErpChart type="bar" data={chartData} /></CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Kategoriyalar</CardTitle></CardHeader>
            <CardContent className="p-0">
              <MiniTable headers={["Kategoriya", "Summa"]} rows={categoryRows} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>To'lov usullari</CardTitle></CardHeader>
            <CardContent className="p-0">
              <MiniTable headers={["To'lov usuli", "Summa"]} rows={paymentTypeRows} />
            </CardContent>
          </Card>
        </div>
        <SchoolErpTable headers={["Xarajat turi", "Kategoriya", "Summa", "Filial", "Sana", "To'lov usuli"]} rows={rows} />
        <TablePagination pagination={overheads.data?.pagination} onOffsetChange={setOffset} />
      </div>
    );
  }
  if (section === "payroll") {
    if (!scope) return <DataState empty="Filial tanlang" />;
    if (salaries.isLoading) return <ContentLoader cards={4} chart={false} />;
    if (salaries.error) return <DataState error={salaries.error} />;
    const rows = [...(salaries.data?.rows ?? [])].sort((a, b) => b.total - a.total || b.remaining - a.remaining).map((item) => [
      item.name,
      item.role === "teacher" ? "O'qituvchi" : item.role === "assistent" ? "Assistent" : "Xodim",
      item.position ?? item.role,
      money(item.base_salary),
      item.bonus ? money(item.bonus) : "-",
      money(item.advance),
      money(item.total),
      money(item.remaining),
      item.status === "paid" ? "To'landi" : item.status === "partial" ? "Qisman" : "Kutilmoqda",
    ]);

    return (
      <div className="space-y-4">
        <FilterBar>
          <Input className="h-9 w-full" placeholder="Qidirish" value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} />
          <Select value={role} onValueChange={(value) => { setRole(value as "all" | "teacher" | "assistent" | "staff"); setOffset(0); }}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Rol</SelectItem>
              <SelectItem value="teacher">O'qituvchi</SelectItem>
              <SelectItem value="assistent">Assistent</SelectItem>
              <SelectItem value="staff">Xodim</SelectItem>
            </SelectContent>
          </Select>
          <Select value={salaryStatus} onValueChange={(value) => { setSalaryStatus(value as "all" | "pending" | "partial" | "paid"); setOffset(0); }}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              <SelectItem value="pending">Kutilmoqda</SelectItem>
              <SelectItem value="partial">Qisman</SelectItem>
              <SelectItem value="paid">To'langan</SelectItem>
            </SelectContent>
          </Select>
          <Input className="h-9 w-full" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} />
          <Input className="h-9 w-full" type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} />
        </FilterBar>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SchoolErpKpiCard title="Jami hisoblangan" value={money(salaries.data?.kpis.accrued)} hint="Oy bo'yicha" />
          <SchoolErpKpiCard title="Bonuslar" value={money(salaries.data?.kpis.bonus_total)} hint={`${salaries.data?.kpis.bonus_employee_count ?? 0} xodim`} tone="green" />
          <SchoolErpKpiCard title="Avans" value={money(salaries.data?.kpis.advance)} hint="To'langan" tone="amber" />
          <SchoolErpKpiCard title="Qolgan" value={money(salaries.data?.kpis.remaining)} hint="Kutilmoqda" tone="red" />
        </div>
        <SchoolErpTable headers={["Xodim", "Rol", "Lavozim", "Asosiy ish haqi", "Bonus", "Avans", "Jami", "Qolgan", "Holat"]} rows={rows} />
        <TablePagination pagination={salaries.data?.pagination} onOffsetChange={setOffset} />
      </div>
    );
  }
  if (section === "cashbank") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <SchoolErpKpiCard title="Kassa" value={money(34_120_000)} hint="Naqd qoldiq" />
          <SchoolErpKpiCard title="Bank" value={money(287_400_000)} hint="Hisob raqam" tone="green" />
          <SchoolErpKpiCard title="Jami" value={money(321_520_000)} hint="Pul mablag'lari" tone="amber" />
        </div>
        <Card><CardHeader><CardTitle>Pul oqimi</CardTitle></CardHeader><CardContent><SchoolErpChart type="line" /></CardContent></Card>
        <SchoolErpTable headers={["Sana", "Tavsif", "Kategoriya", "Hisobdan", "Kirim", "Chiqim", "Qoldiq"]} rows={cashBankRows} />
      </div>
    );
  }
  if (section === "inventory") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Aktivlar amortizatsiyasi</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {["Kompyuterlar - 75% qoldi", "Interaktiv doskalar - 85% qoldi", "Stol-stullar - 60% qoldi", "Kamera tizimi (CCTV) - 45% qoldi"].map((item) => (
              <div key={item} className="rounded-md border p-3">{item}</div>
            ))}
          </CardContent>
        </Card>
        <SchoolErpTable headers={["Tovar", "Kirdi", "Chiqdi", "Qoldiq"]} rows={inventoryRows} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SchoolErpKpiCard title="Jami" value={money(124_300_000)} hint="Yanvar 2025" />
        <SchoolErpKpiCard title="O'sish" value="+12.4%" hint="O'tgan oyga nisbatan" tone="green" />
        <SchoolErpKpiCard title="Reja" value="86%" hint="Bajarildi" tone="amber" />
      </div>
      <Card><CardHeader><CardTitle>{sectionTitles[section]} tahlili</CardTitle></CardHeader><CardContent><SchoolErpChart type="line" /></CardContent></Card>
      <SchoolErpTable headers={["Nomi", "Summa", "Sana", "Izoh", "Holat"]} rows={[["Operatsiya 1", "4,200,000", "12-yan", sectionTitles[section], "Aktiv"], ["Operatsiya 2", "2,900,000", "18-yan", sectionTitles[section], "To'landi"]]} />
    </div>
  );
}
