import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useInstitution } from "@/contexts/InstitutionContext";
import { ArrowLeft, Loader2, Building2, User, Calendar, DollarSign, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  settled: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  overdue: "bg-orange-100 text-orange-700",
};

const DIRECTION_LABELS: Record<string, string> = {
  incoming: "Kirim",
  outgoing: "Chiqim",
  in: "Kirim",
  out: "Chiqim",
};

export default function BranchLoanDetailPage() {
  const navigate = useNavigate();
  const { institution } = useInstitution();
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<BranchLoan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && institution) {
      fetchLoanDetails();
    }
  }, [id, institution]);

  const fetchLoanDetails = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/branch-loans/external/${institution}/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLoan(data);
      }
    } catch (err) {
      console.error("Failed to fetch loan details:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <DashboardLayout title="Tranzaksiya Tafsilotlari">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!loan) {
    return (
      <DashboardLayout title="Tranzaksiya Tafsilotlari">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Tranzaksiya topilmadi</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate("/finance/transactions")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Orqaga
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Tranzaksiya Tafsilotlari"
      headerExtra={
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/finance/transactions")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">
                    {loan.counterparty.name} {loan.counterparty.surname}
                  </h2>
                  <Badge
                    className={`${
                      loan.direction === "incoming" || loan.direction === "in"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {DIRECTION_LABELS[loan.direction] || loan.direction}
                  </Badge>
                  <Badge className={STATUS_COLORS[loan.status] || "bg-gray-100 text-gray-700"}>
                    {STATUS_LABELS[loan.status] || loan.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{loan.counterparty.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Summa</p>
                <p className="text-3xl font-bold">{formatCurrency(loan.principal_amount)} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kontragent Ma'lumotlari */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Kontragent Ma'lumotlari
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ism Familiya</p>
                <p className="font-medium">
                  {loan.counterparty.name} {loan.counterparty.surname}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Telefon</p>
                <p className="font-medium">{loan.counterparty.phone}</p>
              </div>
              {loan.counterparty.id && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">ID</p>
                  <p className="font-medium">{loan.counterparty.id}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filial Ma'lumotlari */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Filial Ma'lumotlari
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Manba</p>
                <p className="font-medium uppercase">{loan.source}</p>
              </div>
              {loan.location_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Lokatsiya</p>
                  <p className="font-medium">{loan.location_name}</p>
                </div>
              )}
              {loan.branch_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Filial</p>
                  <p className="font-medium">{loan.branch_name}</p>
                </div>
              )}
              {loan.management_id && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Management ID</p>
                  <p className="font-medium">{loan.management_id}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Moliyaviy Ma'lumotlar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Moliyaviy Ma'lumotlar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Asosiy Summa</p>
                <p className="text-xl font-bold">{formatCurrency(loan.principal_amount)} UZS</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Yo'nalish</p>
                <Badge
                  className={`${
                    loan.direction === "incoming" || loan.direction === "in"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {DIRECTION_LABELS[loan.direction] || loan.direction}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge className={STATUS_COLORS[loan.status] || "bg-gray-100 text-gray-700"}>
                  {STATUS_LABELS[loan.status] || loan.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Sanalar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Sanalar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Berilgan Sana</p>
                <p className="font-medium">{formatDate(loan.issued_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Muddati</p>
                <p className="font-medium">{formatDate(loan.due_date)}</p>
              </div>
              {loan.settled_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">To'langan Sana</p>
                  <p className="font-medium">{formatDate(loan.settled_date)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Qo'shimcha Ma'lumotlar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Qo'shimcha Ma'lumotlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Sabab</p>
              <p className="font-medium">{loan.reason}</p>
            </div>
            {loan.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Izohlar</p>
                <p className="font-medium">{loan.notes}</p>
              </div>
            )}
            {loan.cancelled_reason && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Bekor Qilish Sababi</p>
                <p className="font-medium text-red-600">{loan.cancelled_reason}</p>
              </div>
            )}
            {loan.deleted && (
              <div>
                <Badge variant="destructive">O'chirilgan</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
