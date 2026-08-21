import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useInstitution } from "@/contexts/InstitutionContext";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Branch {
  id: number;
  name: string;
}

interface BranchLoan {
  id: number;
  source: string;
  management_id: number | null;
  location_id: number | null;
  location_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  counterparty: {
    id: number | null;
    name: string;
    surname: string;
    phone: string;
  };
  direction: string;
  principal_amount: number;
  issued_date: string;
  due_date: string;
  settled_date: string | null;
  reason: string;
  notes: string | null;
  status: string;
  cancelled_reason: string | null;
  deleted: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  active: "Faol",
  settled: "To'langan",
  cancelled: "Bekor qilingan",
  overdue: "Muddati o'tgan",
};

const DIRECTION_LABELS: Record<string, string> = {
  incoming: "Kirim",
  outgoing: "Chiqim",
};

export default function BranchLoansPage() {
  const navigate = useNavigate();
  const { institution } = useInstitution();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loans, setLoans] = useState<BranchLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDirection, setSelectedDirection] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<BranchLoan | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    apiFetch(`/${institution}/branches`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Branch[]) => {
        const list = Array.isArray(d) ? d : [];
        setBranches(list);
        if (list.length > 0) setSelectedBranch(String(list[0].id));
      })
      .catch(() => { });
  }, [institution]);

  useEffect(() => {
    fetchLoans();
  }, [selectedBranch, selectedStatus, selectedDirection, institution]);

  const fetchLoans = async () => {
    if (!selectedBranch) return;
    setLoading(true);
    setLoans([]);

    const params = new URLSearchParams();
    // Add source (system name)
    params.append("source", institution);
    // Use branch_id for Turon, location_id for Gennis
    const branchParam = institution === "turon" ? "branch_id" : "location_id";
    params.append(branchParam, selectedBranch);
    if (selectedStatus !== "all") params.append("status", selectedStatus);
    if (selectedDirection !== "all") params.append("direction", selectedDirection);

    try {
      const res = await apiFetch(`/branch-loans/external?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLoans(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch loans:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanDetails = async (loanId: number, source: string) => {
    try {
      const res = await apiFetch(`/branch-loans/external/${source}/${loanId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLoan(data);
        setDetailsOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch loan details:", err);
    }
  };

  const filteredLoans = loans.filter((loan) => {
    const query = searchQuery.toLowerCase();
    return (
      loan.counterparty.name.toLowerCase().includes(query) ||
      loan.counterparty.surname.toLowerCase().includes(query) ||
      loan.counterparty.phone.includes(query) ||
      loan.reason.toLowerCase().includes(query)
    );
  });

  const totalAmount = filteredLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);
  const incomingAmount = filteredLoans
    .filter((l) => l.direction === "incoming")
    .reduce((sum, loan) => sum + loan.principal_amount, 0);
  const outgoingAmount = filteredLoans
    .filter((l) => l.direction === "outgoing")
    .reduce((sum, loan) => sum + loan.principal_amount, 0);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("uz-UZ");
  };

  const filterControls = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
      <Button variant="outline" size="sm" onClick={() => navigate("/finance")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
      </Button>
      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
        <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
          <SelectValue placeholder="Filial tanlang" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
        <SelectTrigger className="w-full sm:w-40 h-8 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Barchasi</SelectItem>
          <SelectItem value="pending">Kutilmoqda</SelectItem>
          <SelectItem value="active">Faol</SelectItem>
          <SelectItem value="settled">To'langan</SelectItem>
          <SelectItem value="cancelled">Bekor qilingan</SelectItem>
          <SelectItem value="overdue">Muddati o'tgan</SelectItem>
        </SelectContent>
      </Select>
      <Select value={selectedDirection} onValueChange={setSelectedDirection}>
        <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
          <SelectValue placeholder="Yo'nalish" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Barchasi</SelectItem>
          <SelectItem value="incoming">Kirim</SelectItem>
          <SelectItem value="outgoing">Chiqim</SelectItem>
        </SelectContent>
      </Select>
      <div className="relative w-full sm:w-48">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Qidirish..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-8 text-xs w-full"
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Tranzaksiyalar" headerExtra={filterControls}>
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Umumiy Summa</p>
              <p className="text-lg font-bold">{formatCurrency(totalAmount)} UZS</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 border-l-2 border-l-green-500">
              <p className="text-xs text-muted-foreground mb-1">Kirim</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(incomingAmount)} UZS</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 border-l-2 border-l-red-500">
              <p className="text-xs text-muted-foreground mb-1">Chiqim</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(outgoingAmount)} UZS</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="px-4 pt-4 pb-2">
              <p className="text-sm font-semibold">Tranzaksiyalar Ro'yxati</p>
            </div>
            <div className="overflow-y-auto max-h-[560px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Kontragent</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-center">Yo'nalish</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead className="text-center">To'lov turi</TableHead>
                    <TableHead className="text-center">Berilgan sana</TableHead>
                    <TableHead className="text-center">Muddati</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Sabab</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredLoans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-20 text-center text-muted-foreground text-sm">
                        Ma'lumot topilmadi
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLoans.map((loan) => (
                      <TableRow
                        key={loan.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/finance/transactions/${loan.id}`)}
                      >
                        <TableCell>
                          {loan.counterparty.name} {loan.counterparty.surname}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{loan.counterparty.phone}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${loan.direction === "incoming"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                              }`}
                          >
                            {DIRECTION_LABELS[loan.direction] || loan.direction}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(loan.principal_amount)} UZS
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">
                          —
                        </TableCell>
                        <TableCell className="text-center text-xs">{formatDate(loan.issued_date)}</TableCell>
                        <TableCell className="text-center text-xs">{formatDate(loan.due_date)}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${loan.status === "settled"
                              ? "bg-green-100 text-green-700"
                              : loan.status === "cancelled"
                                ? "bg-gray-100 text-gray-700"
                                : loan.status === "overdue"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                          >
                            {STATUS_LABELS[loan.status] || loan.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {loan.reason}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tranzaksiya Tafsilotlari</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Kontragent</p>
                  <p className="text-sm font-medium">
                    {selectedLoan.counterparty.name} {selectedLoan.counterparty.surname}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Telefon</p>
                  <p className="text-sm font-medium">{selectedLoan.counterparty.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Yo'nalish</p>
                  <p className="text-sm font-medium">{DIRECTION_LABELS[selectedLoan.direction]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className="text-sm font-medium">{STATUS_LABELS[selectedLoan.status]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Summa</p>
                  <p className="text-sm font-bold">{formatCurrency(selectedLoan.principal_amount)} UZS</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">To'lov turi</p>
                  <p className="text-sm font-medium">—</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Berilgan sana</p>
                  <p className="text-sm font-medium">{formatDate(selectedLoan.issued_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Muddati</p>
                  <p className="text-sm font-medium">{formatDate(selectedLoan.due_date)}</p>
                </div>
                {selectedLoan.settled_date && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">To'langan sana</p>
                    <p className="text-sm font-medium">{formatDate(selectedLoan.settled_date)}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Sabab</p>
                  <p className="text-sm font-medium">{selectedLoan.reason}</p>
                </div>
                {selectedLoan.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Izohlar</p>
                    <p className="text-sm font-medium">{selectedLoan.notes}</p>
                  </div>
                )}
                {selectedLoan.cancelled_reason && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Bekor qilish sababi</p>
                    <p className="text-sm font-medium text-red-600">{selectedLoan.cancelled_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
