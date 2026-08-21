import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Users, GraduationCap, Clock, CalendarCheck, CheckCircle2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendancePeriod {
  id: number;
  month_date: string;
  total_debt: number;
  remaining_debt: number;
  discount: number;
  payment: number;
  status: boolean;
  student: { id: number; name: string; surname: string; phone: string };
}

interface TimetableEntry {
  id: number;
  date: string;
  weekday: string;
  hours: { id: number; name: string; start_time: string; end_time: string };
  room: { id: number; name: string } | null;
  teacher: { id: number; name: string } | null;
  subject: { id: number; name: string } | null;
}

interface GroupDetail {
  id: number;
  name: string;
  price: number | null;
  status: boolean;
  deleted: boolean;
  count: number;
  branch: { id: number; name: string } | null;
  language: { id: number; name: string } | null;
  subject: { id: number; name: string } | null;
  color: { id: number; name: string; value: string } | null;
  class_number: {
    id: number;
    number: number;
    price: number | null;
    curriculum_hours: number | null;
    class_types: any;
  } | null;
  teachers: { id: number; name: string; surname: string; phone: string; color: string }[];
  students: { id: number; name: string; surname: string; phone: string; debt_status: string | null }[];
}

const MONTH_UZ: Record<number, string> = {
  1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel",
  5: "May", 6: "Iyun", 7: "Iyul", 8: "Avgust",
  9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("uz-UZ");
}

function InfoCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="border rounded-lg p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolGroupProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendancePeriod[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/turon/group/profile/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Sinf topilmadi");
        return res.json();
      })
      .then((data) => setGroup(data))
      .catch((err) => toast.error(err?.message ?? "Xatolik yuz berdi"))
      .finally(() => setLoading(false));

    apiFetch(`/turon/timetable/group/${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setTimetable(Array.isArray(data) ? data : []))
      .catch(() => {});

    apiFetch(`/turon/attendance/periods?group_id=${id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setAttendance(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Sinf profili">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout title="Sinf profili">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
        <div className="text-center text-muted-foreground py-20">Sinf topilmadi</div>
      </DashboardLayout>
    );
  }

  const colorValue = group.color?.value ?? "#94a3b8";

  return (
    <DashboardLayout title="Sinf profili">
      <div className="flex flex-col h-full overflow-hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-1 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>

        <div className="flex flex-col flex-1 min-h-0 gap-6 overflow-hidden">
          {/* Header card */}
          <div className="border rounded-lg p-5 shrink-0">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0"
                  style={{ backgroundColor: colorValue }}
                >
                  {group.class_number?.number ?? "?"}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{group.name || "—"}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                    {group.class_number && <span>{group.class_number.number}-sinf</span>}
                    {group.language && <span>· {group.language.name}</span>}
                    {group.branch && <span>· {group.branch.name}</span>}
                    {group.subject && <span>· {group.subject.name}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={group.status ? "default" : "secondary"}
                      className={group.status ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : ""}>
                      {group.status ? "Faol" : "Nofaol"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Teachers */}
              {group.teachers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {group.teachers.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/school/teachers/${t.id}`)}
                      className="flex items-center gap-2 border rounded-lg px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">O'qituvchi</p>
                        <p className="text-sm font-medium">{t.name} {t.surname}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoCard label="O'quvchilar" value={`${group.count} ta`} />
              <InfoCard label="Narx" value={group.price ? `${fmt(group.price)} so'm` : "—"} sub="oyiga" />
              {group.class_number?.curriculum_hours != null && (
                <InfoCard label="Dars soatlari" value={`${group.class_number.curriculum_hours} soat`} sub="haftalik" />
              )}
              {group.class_number?.price != null && (
                <InfoCard label="Sinf narxi" value={`${fmt(group.class_number.price)} so'm`} />
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="students" className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto mb-4 shrink-0">
              <TabsTrigger value="students" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <Users className="h-3.5 w-3.5 mr-1.5" /> O'quvchilar
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-4">{group.students.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="timetable" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <Clock className="h-3.5 w-3.5 mr-1.5" /> Dars jadvali
              </TabsTrigger>
              <TabsTrigger value="attendance" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <CalendarCheck className="h-3.5 w-3.5 mr-1.5" /> Davomat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="students" className="flex-1 min-h-0 overflow-y-auto">
              {group.students.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Ism familiya</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Telefon</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Qarz holati</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.students.map((s, i) => (
                        <tr
                          key={s.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/school/students/${s.id}`)}
                        >
                          <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3 font-medium">{s.name} {s.surname}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.phone || "—"}</td>
                          <td className="px-4 py-3">
                            {s.debt_status
                              ? <Badge variant="destructive" className="text-xs">{s.debt_status}</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                  O'quvchilar topilmadi
                </div>
              )}
            </TabsContent>
            <TabsContent value="timetable" className="flex-1 min-h-0 overflow-hidden">
              {timetable.length > 0 ? (() => {
                // Unique days sorted by date
                const daysMap = new Map<string, { date: string; weekday: string }>();
                timetable.forEach((e) => {
                  if (!daysMap.has(e.date)) daysMap.set(e.date, { date: e.date, weekday: e.weekday });
                });
                const days = Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));

                // Unique hours sorted by start_time
                const hoursMap = new Map<number, TimetableEntry["hours"]>();
                timetable.forEach((e) => {
                  if (!hoursMap.has(e.hours.id)) hoursMap.set(e.hours.id, e.hours);
                });
                const hours = Array.from(hoursMap.values()).sort((a, b) =>
                  a.start_time.localeCompare(b.start_time)
                );

                // Lookup: date + hourId → entry
                const cellMap = new Map<string, TimetableEntry>();
                timetable.forEach((e) => cellMap.set(`${e.date}_${e.hours.id}`, e));

                return (
                  <div className="border rounded-lg overflow-auto h-full w-full">
                    <table className="text-xs border-collapse w-full">
                      <thead className="sticky top-0 z-20">
                        <tr>
                          <th className="border-r border-b bg-card px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-30 min-w-[120px]">
                            Vaqt
                          </th>
                          {days.map((day) => (
                            <th key={day.date} className="border-r last:border-r-0 border-b bg-card px-3 py-2.5 text-center font-medium min-w-[150px]">
                              <div className="font-semibold">{day.weekday}</div>
                              <div className="text-muted-foreground font-normal mt-0.5">
                                {new Date(day.date).toLocaleDateString("uz-UZ")}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hours.map((hour) => (
                          <tr key={hour.id} className="border-b last:border-0">
                            <td className="border-r bg-card px-3 py-2.5 font-medium whitespace-nowrap sticky left-0 z-10">
                              <div>{hour.name}</div>
                              <div className="text-muted-foreground font-normal mt-0.5">
                                {hour.start_time.slice(0, 5)} – {hour.end_time.slice(0, 5)}
                              </div>
                            </td>
                            {days.map((day) => {
                              const entry = cellMap.get(`${day.date}_${hour.id}`);
                              return (
                                <td key={day.date} className="border-r last:border-r-0 px-2 py-2 align-top">
                                  {entry ? (
                                    <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5">
                                      {entry.subject && (
                                        <div className="font-semibold text-primary leading-tight">{entry.subject.name}</div>
                                      )}
                                      {entry.teacher && (
                                        <div className="text-muted-foreground mt-0.5">{entry.teacher.name}</div>
                                      )}
                                      {entry.room && (
                                        <div className="text-muted-foreground">{entry.room.name}</div>
                                      )}
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })() : (
                <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                  Dars jadvali mavjud emas
                </div>
              )}
            </TabsContent>

            <TabsContent value="attendance" className="flex-1 min-h-0 overflow-hidden">
              {attendance.length > 0 ? (() => {
                // Unique months sorted
                const months = [...new Set(attendance.map((a) => a.month_date))]
                  .sort((a, b) => a.localeCompare(b));

                // Unique students sorted by name
                const studentMap = new Map<number, AttendancePeriod["student"]>();
                attendance.forEach((a) => {
                  if (!studentMap.has(a.student.id)) studentMap.set(a.student.id, a.student);
                });
                const students = Array.from(studentMap.values()).sort((a, b) =>
                  `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`)
                );

                // Lookup: studentId_monthDate → period
                const cellMap = new Map<string, AttendancePeriod>();
                attendance.forEach((a) => cellMap.set(`${a.student.id}_${a.month_date}`, a));

                const paidCount = attendance.filter((a) => a.status).length;
                const unpaidCount = attendance.filter((a) => !a.status).length;

                return (
                  <div className="flex flex-col h-full gap-3">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3 shrink-0">
                      <div className="border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Jami yozuvlar</p>
                        <p className="text-lg font-bold">{attendance.length}</p>
                      </div>
                      <div className="border rounded-lg p-3 text-center bg-green-50 border-green-200">
                        <p className="text-xs text-green-600 mb-1">To'langan</p>
                        <p className="text-lg font-bold text-green-600">{paidCount}</p>
                      </div>
                      <div className="border rounded-lg p-3 text-center bg-red-50 border-red-200">
                        <p className="text-xs text-red-600 mb-1">To'lanmagan</p>
                        <p className="text-lg font-bold text-red-600">{unpaidCount}</p>
                      </div>
                    </div>

                    {/* Grid */}
                    <div className="border rounded-lg overflow-auto flex-1 min-h-0">
                      <table className="text-xs border-collapse" style={{ minWidth: "max-content" }}>
                        <thead className="sticky top-0 z-20">
                          <tr>
                            <th className="border-r border-b bg-card px-3 py-2.5 text-left font-medium text-muted-foreground sticky left-0 z-30 min-w-[160px]">
                              O'quvchi
                            </th>
                            {months.map((m) => {
                              const d = new Date(m);
                              return (
                                <th key={m} className="border-r last:border-r-0 border-b bg-card px-3 py-2.5 text-center font-medium min-w-[90px] whitespace-nowrap">
                                  <div>{MONTH_UZ[d.getMonth() + 1]}</div>
                                  <div className="text-muted-foreground font-normal">{d.getFullYear()}</div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr
                              key={student.id}
                              className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                              onClick={() => navigate(`/school/students/${student.id}`)}
                            >
                              <td className="border-r bg-card px-3 py-2 sticky left-0 z-10 font-medium whitespace-nowrap">
                                {student.name} {student.surname}
                              </td>
                              {months.map((m) => {
                                const period = cellMap.get(`${student.id}_${m}`);
                                if (!period) return (
                                  <td key={m} className="border-r last:border-r-0 px-2 py-2 text-center" />
                                );
                                return (
                                  <td key={m} className="border-r last:border-r-0 px-2 py-2 text-center">
                                    {period.status ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-400 mx-auto" />
                                    )}
                                    {period.remaining_debt > 0 && (
                                      <div className="text-red-500 mt-0.5 leading-none" style={{ fontSize: "10px" }}>
                                        {fmt(period.remaining_debt)}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })() : (
                <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                  Davomat ma'lumotlari topilmadi
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
