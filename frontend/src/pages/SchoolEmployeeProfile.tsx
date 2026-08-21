import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeDetail {
  id: number;
  deleted: boolean;
  group: { id: number; name: string };
  user: {
    id: number;
    name: string;
    surname: string;
    father_name: string;
    phone: string | null;
    comment: string;
    registered_date: string;
    birth_date: string;
    age: number | null;
    balance: number | null;
    face_id: string | null;
    language: { id: number; name: string } | null;
    branch: { id: number; name: string } | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolEmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/turon/users/employees/${id}`)
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => toast.error("Ma'lumotlarni yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Ishchi profili">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout title="Ishchi profili">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
        <div className="text-center text-muted-foreground py-20">Ishchi topilmadi</div>
      </DashboardLayout>
    );
  }

  const { user: u, group } = profile;
  const fullName = `${u.name} ${u.surname}`;
  const initials = `${u.name?.[0] ?? ""}${u.surname?.[0] ?? ""}`.toUpperCase();

  return (
    <DashboardLayout title="Ishchi profili">
      <div className="flex flex-col h-full overflow-hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-1 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>

        <div className="lg:col-span-1 overflow-y-auto pr-1 max-w-sm">
          <div className="border rounded-lg p-5">
            <div className="flex flex-col items-center text-center mb-4">
              <Avatar className="h-20 w-20 mb-3">
                <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <h2 className="font-semibold text-base">{fullName}</h2>
              {u.father_name && (
                <p className="text-xs text-muted-foreground mt-0.5">{u.father_name}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                <Badge variant="secondary" className="text-xs">{group.name}</Badge>
                {profile.deleted && (
                  <Badge variant="destructive" className="text-xs">O'chirilgan</Badge>
                )}
              </div>
            </div>

            <Separator className="mb-3" />

            <div className="space-y-0">
              {u.phone && (
                <>
                  <InfoRow label="Telefon" value={u.phone} />
                  <Separator />
                </>
              )}
              {u.birth_date && (
                <>
                  <InfoRow label="Tug'ilgan sana" value={new Date(u.birth_date).toLocaleDateString("uz-UZ")} />
                  <Separator />
                </>
              )}
              {u.age != null && (
                <>
                  <InfoRow label="Yosh" value={u.age} />
                  <Separator />
                </>
              )}
              {u.registered_date && (
                <>
                  <InfoRow label="Ro'yxat sanasi" value={new Date(u.registered_date).toLocaleDateString("uz-UZ")} />
                  <Separator />
                </>
              )}
              {u.language && (
                <>
                  <InfoRow label="Til" value={u.language.name} />
                  <Separator />
                </>
              )}
              {u.branch && (
                <>
                  <InfoRow label="Filial" value={u.branch.name} />
                  <Separator />
                </>
              )}
              {u.face_id && (
                <InfoRow label="Face ID" value={
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{u.face_id}</code>
                } />
              )}
              {u.comment && (
                <>
                  <Separator />
                  <InfoRow label="Izoh" value={u.comment} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
