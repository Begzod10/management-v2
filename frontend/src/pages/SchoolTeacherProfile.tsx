import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, CalendarDays, Loader2, User, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherDetail {
  id: number;
  color: string | null;
  deleted: boolean;
  status: boolean;
  user: {
    id: number;
    name: string;
    surname: string;
    phone: string | null;
    birth_date: string | null;
    registered_date: string | null;
    language: { id: number; name: string } | null;
    balance: string | null;
    comment: string | null;
    face_id: string | null;
    branch: { id: number; name: string } | null;
  };
  class_type: { id: number; name: string } | null;
  subjects: { id: number; name: string }[];
  groups: { id: number; name: string; class_number?: number; color?: string; [key: string]: any }[];
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

// ─── Timetable Types ──────────────────────────────────────────────────────────

interface TimetableLesson {
  id?: number;
  status: boolean;
  hours: number;
  roomName?: string;
  room: { id: number; name: string } | null;
  group: { id: number; name: string } | null;
  teacher: { id: number; name: string; surname: string } | null;
  subject: { id: number; name: string } | null;
  is_flow?: boolean;
}

interface TimetableRoom {
  id: number;
  name: string;
  lessons: TimetableLesson[];
}

interface TimetableDay {
  date: string;
  weekday: string;
  rooms: TimetableRoom[];
}

interface TimetableHour {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

interface TimetableResponse {
  time_tables: TimetableDay[];
  hours_list: TimetableHour[];
}

// ─── Timetable Tab ────────────────────────────────────────────────────────────

function TeacherTimetableTab({ teacherId, branchId }: { teacherId: string; branchId: number | null }) {
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/turon/timetable/lessons?branch=${branchId}&teacher=${teacherId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled) setTimetable(data?.time_tables ? data : null);
      })
      .catch(() => { if (!cancelled) toast.error("Xatolik yuz berdi"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teacherId, branchId]);

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !branchId ? (
        <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
          O'qituvchining filiali aniqlanmadi
        </div>
      ) : !timetable ? (
        <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
          Dars jadvali mavjud emas
        </div>
      ) : (() => {
          const getLessons = (day: TimetableDay, hourId: number) => {
            const result: TimetableLesson[] = [];
            day.rooms.forEach((room) =>
              room.lessons.forEach((lesson) => {
                if (lesson.id && lesson.hours === hourId) {
                  result.push({ ...lesson, roomName: room.name });
                }
              })
            );
            return result;
          };

          const activeDays = timetable.time_tables.filter((day) =>
            timetable.hours_list.some((hour) => getLessons(day, hour.id).length > 0)
          );

          if (activeDays.length === 0) {
            return (
              <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                Dars jadvali mavjud emas
              </div>
            );
          }

          const activeHours = timetable.hours_list.filter((hour) =>
            timetable.time_tables.some((day) => getLessons(day, hour.id).length > 0)
          );

          return (
            <div className="border rounded-lg overflow-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr>
                    <th className="border-r border-b bg-muted/50 px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-10 min-w-[90px]">
                      Vaqt
                    </th>
                    {activeDays.map((day, i) => (
                      <th key={i} className="border-r last:border-r-0 border-b bg-muted/50 px-3 py-2.5 text-center font-medium min-w-[130px]">
                        <div className="font-semibold">{day.weekday}</div>
                        <div className="text-muted-foreground font-normal mt-0.5 text-[10px]">
                          {new Date(day.date).toLocaleDateString("uz-UZ")}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeHours.map((hour) => (
                    <tr key={hour.id} className="border-b last:border-0">
                      <td className="border-r bg-muted/30 px-3 py-2.5 font-medium whitespace-nowrap sticky left-0">
                        <div>{hour.start_time.slice(0, 5)}</div>
                        <div className="text-muted-foreground font-normal">{hour.end_time.slice(0, 5)}</div>
                      </td>
                      {activeDays.map((day, di) => {
                        const lessons = getLessons(day, hour.id);
                        return (
                          <td key={di} className="border-r last:border-r-0 px-1.5 py-1.5 align-top">
                            {lessons.length > 0 && (
                              <div className="flex gap-1 h-full">
                                {lessons.map((lesson, li) => (
                                  <div
                                    key={li}
                                    className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 min-w-0"
                                    style={{ flex: `1 1 ${100 / lessons.length}%` }}
                                  >
                                    {lesson.subject && (
                                      <div className="font-semibold text-primary leading-tight truncate">{lesson.subject.name}</div>
                                    )}
                                    {lesson.group && (
                                      <div className="text-muted-foreground mt-0.5 truncate">{lesson.group.name}</div>
                                    )}
                                    {lesson.roomName && (
                                      <div className="text-muted-foreground truncate">{lesson.roomName}</div>
                                    )}
                                  </div>
                                ))}
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
          );
        })()
      }
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolTeacherProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch(`/turon/teachers/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("O'qituvchi topilmadi");
        return res.json();
      })
      .then((data) => setTeacher(data))
      .catch((err) => toast.error(err?.message ?? "Xatolik yuz berdi"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="O'qituvchi profili">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!teacher) {
    return (
      <DashboardLayout title="O'qituvchi profili">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
        <div className="text-center text-muted-foreground py-20">O'qituvchi topilmadi</div>
      </DashboardLayout>
    );
  }

  const { user: u } = teacher;
  const fullName = `${u.name} ${u.surname}`;
  const initials = `${u.name?.[0] ?? ""}${u.surname?.[0] ?? ""}`.toUpperCase();

  return (
    <DashboardLayout title="O'qituvchi profili">
      <div className="flex flex-col h-full overflow-hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-1 shrink-0">
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* Left — profile card */}
          <div className="lg:col-span-1 overflow-y-auto pr-1">
            <div className="border rounded-lg p-5">
              <div className="flex flex-col items-center text-center mb-4">
                <Avatar className="h-20 w-20 mb-3">
                  <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h2 className="font-semibold text-base">{fullName}</h2>
                <div className="mt-1">
                  {teacher.status
                    ? <Badge variant="secondary" className="text-xs text-green-600 bg-green-50 border-green-200">Faol</Badge>
                    : <Badge variant="secondary" className="text-xs text-muted-foreground">Nofaol</Badge>
                  }
                </div>
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  {teacher.subjects.map((s) => (
                    <Badge key={s.id} variant="outline" className="text-xs">{s.name}</Badge>
                  ))}
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
                {teacher.class_type && (
                  <>
                    <InfoRow label="Sinf turi" value={teacher.class_type.name} />
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

          {/* Right — tabs */}
          <div className="lg:col-span-2 overflow-y-auto">
            <Tabs defaultValue="info">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto mb-4">
                <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <User className="h-3.5 w-3.5 mr-1.5" /> Ma'lumotlar
                </TabsTrigger>
                <TabsTrigger value="groups" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <Users className="h-3.5 w-3.5 mr-1.5" /> Sinflar
                  {teacher.groups.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0 h-4">{teacher.groups.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="timetable" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Dars jadvali
                </TabsTrigger>
              </TabsList>

              {/* Info tab */}
              <TabsContent value="info" className="space-y-4">
                {teacher.subjects.length > 0 && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3">Fanlar</h3>
                    <div className="space-y-1">
                      {teacher.subjects.map((s) => (
                        <div key={s.id} className="py-2 px-3 rounded-md bg-muted/30 text-sm">{s.name}</div>
                      ))}
                    </div>
                  </div>
                )}

                {teacher.class_type && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-2">Sinf turi</h3>
                    <Badge variant="secondary">{teacher.class_type.name}</Badge>
                  </div>
                )}

                {teacher.subjects.length === 0 && !teacher.class_type && (
                  <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                    Ma'lumot topilmadi
                  </div>
                )}
              </TabsContent>

              {/* Groups tab */}
              <TabsContent value="groups">
                {teacher.groups.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sinf nomi</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sinf raqami</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teacher.groups.map((g, i) => (
                          <tr
                            key={g.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/school/groups/${g.id}`)}
                          >
                            <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {g.color && (
                                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                                )}
                                <span className="font-medium">{g.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {g.class_number
                                ? <Badge variant="secondary" className="text-xs">{g.class_number}-sinf</Badge>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                    Sinflar topilmadi
                  </div>
                )}
              </TabsContent>
              {/* Timetable tab */}
              <TabsContent value="timetable">
                <TeacherTimetableTab teacherId={String(teacher.id)} branchId={teacher.user.branch?.id ?? null} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
