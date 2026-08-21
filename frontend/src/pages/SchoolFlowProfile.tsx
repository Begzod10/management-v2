import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlowStudent {
  id: number;
  name: string;
  surname: string;
  phone: string;
  parents_phone: string;
  balance: string | null;
}

interface FlowTeacher {
  id: number;
  name: string;
  surname: string;
  subject: { id: number; name: string }[];
}

interface FlowProfile {
  id: number;
  name: string;
  activity: boolean;
  subject_name: string | null;
  level_name: string | null;
  teacher: FlowTeacher | null;
  students: FlowStudent[];
  classes: number[];
  order_by: number;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolFlowProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<FlowProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/turon/flow/flow-profile/${id}`)
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => toast.error("Ma'lumotlarni yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Flow profili">
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout title="Flow profili">
        <div className="flex flex-col items-center py-24 gap-3">
          <p className="text-sm text-muted-foreground">Flow topilmadi</p>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={profile.name}>
      {/* Back button */}
      <div className="flex items-center gap-3 mb-5">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {/* Teacher card */}
        <div className="border rounded-lg p-4 bg-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Teacher</p>
            {profile.teacher ? (
              <>
                <p className="font-semibold text-sm">
                  {profile.teacher.surname} {profile.teacher.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.teacher.subject.map((s) => (
                    <Badge key={s.id} variant="secondary" className="text-xs">{s.name}</Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Info card */}
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-3">Info</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">Name:</span>
              <span className="font-medium">{profile.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-20">Activity:</span>
              <div className="w-3 h-3 rounded-full"
                style={{ backgroundColor: profile.activity ? "#22c55e" : "#ef4444" }} />
            </div>
            {profile.subject_name && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-20">Fan:</span>
                <span>{profile.subject_name}</span>
              </div>
            )}
            {profile.level_name && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-20">Level:</span>
                <span>{profile.level_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Students table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">O'quvchilar ro'yxati</h2>
        <span className="text-xs text-muted-foreground">{profile.students.length} ta</span>
      </div>

      <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-380px)]">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Ism Familya</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-[140px]">Tel</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-[140px]">Tel Ota-ona</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground w-[130px]">Balans</th>
            </tr>
          </thead>
          <tbody>
            {profile.students.map((s) => {
              const balance = s.balance != null ? Number(s.balance) : null;
              return (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="font-medium">{s.surname} {s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.parents_phone}</td>
                  <td className="px-4 py-3 text-right">
                    {balance != null ? (
                      <span className={`inline-block border rounded px-2 py-0.5 text-xs font-medium
                        ${balance < 0 ? "border-red-400 text-red-500" : "border-green-400 text-green-600"}`}>
                        {balance.toLocaleString("uz-UZ")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
