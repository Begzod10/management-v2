import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, User, FileText, Clock, AlertCircle, Loader2, CheckCircle2, XCircle, Tag } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentDetail {
  id: number;
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
  parents_number: string | null;
  shift: string | null;
  debt_status: string | null;
  color: string | null;
  class_number: { id: number; number: number } | null;
  subjects: { id: number; name: string; [key: string]: any }[];
  groups: { id: number; name: string; class_number: number; color: string }[];
}

interface Charity {
  id: number;
  charity_sum: number;
  name: string | null;
}

interface PaymentMonth {
  id: number;
  name: string;
  number: string;
  price: number;
}

interface MissingMonthItem {
  id: number;
  name: string;
  number: number;
  year: number;
}

interface MissingMonthData {
  id: number;
  month_date: string;
  total_debt: number;
  remaining_debt: number;
  discount: number;
  status: boolean;
  payment: number;
}

interface MissingMonthsResponse {
  month: MissingMonthItem[];
  data: MissingMonthData[];
}

interface TimetableLesson {
  status: boolean;
  hours: number;
  room: { id: number; name: string } | null;
  group: { id: number; name: string } | null;
  teacher: { id: number; name: string; surname: string } | null;
  subject: { id: number; name: string } | null;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("uz-UZ");
}

function parseBalance(balance: string | null | undefined): number {
  if (!balance) return 0;
  return parseFloat(balance) || 0;
}

const MONTH_UZ: Record<string, string> = {
  January: "Yanvar", February: "Fevral", March: "Mart",
  April: "Aprel", May: "May", June: "Iyun",
  July: "Iyul", August: "Avgust", September: "Sentabr",
  October: "Oktabr", November: "Noyabr", December: "Dekabr",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [charity, setCharity] = useState<Charity | null>(null);
  const [paymentMonths, setPaymentMonths] = useState<PaymentMonth[]>([]);
  const [missingMonths, setMissingMonths] = useState<MissingMonthsResponse | null>(null);
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchAll() {
      setLoading(true);
      try {
        const [studentRes, charitiesRes, paymentRes, missingRes] = await Promise.all([
          apiFetch(`/turon/students/${id}`),
          apiFetch(`/turon/students/${id}/charities`),
          apiFetch(`/turon/students/${id}/payment-months`),
          apiFetch(`/turon/students/${id}/missing-months`),
        ]);

        if (!studentRes.ok) throw new Error("O'quvchi ma'lumotlari topilmadi");

        const [studentData, charitiesData, paymentData, missingData] = await Promise.all([
          studentRes.json(),
          charitiesRes.ok ? charitiesRes.json() : null,
          paymentRes.ok ? paymentRes.json() : [],
          missingRes.ok ? missingRes.json() : null,
        ]);

        setStudent(studentData);
        setCharity(charitiesData && typeof charitiesData === "object" && !Array.isArray(charitiesData) ? charitiesData : null);
        setPaymentMonths(Array.isArray(paymentData) ? paymentData : []);
        setMissingMonths(missingData && missingData.month ? missingData : null);

        const branchId = studentData?.user?.branch?.id;
        if (branchId) {
          const timetableRes = await apiFetch(`/turon/timetable/lessons?branch=${branchId}&student=${id}`);
          if (timetableRes.ok) {
            const timetableData = await timetableRes.json();
            if (timetableData?.time_tables) {
              setTimetable(timetableData as TimetableResponse);
            }
          }
        }
      } catch (err: any) {
        toast.error(err?.message ?? "Xatolik yuz berdi");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="O'quvchi profili">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout title="O'quvchi profili">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 -ml-1">
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
        <div className="text-center text-muted-foreground py-20">O'quvchi topilmadi</div>
      </DashboardLayout>
    );
  }

  const { user: u } = student;
  const fullName = `${u.name} ${u.surname}`;
  const initials = `${u.name?.[0] ?? ""}${u.surname?.[0] ?? ""}`.toUpperCase();
  const balance = parseBalance(u.balance);
  const hasDebt = balance < 0;

  // Join month names with data for the payments table
  const paymentRows = missingMonths
    ? missingMonths.data.map((d) => {
        const monthInfo = missingMonths.month.find((m) => m.id === d.id);
        return { ...d, monthName: monthInfo ? (MONTH_UZ[monthInfo.name] ?? monthInfo.name) : "—", year: monthInfo?.year };
      })
    : [];

  const paidCount = paymentRows.filter((r) => r.status).length;
  const unpaidCount = paymentRows.filter((r) => !r.status).length;

  return (
    <DashboardLayout title="O'quvchi profili">
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
              <div className="flex flex-wrap gap-1 justify-center mt-2">
                {student.groups.map((g) => (
                  <Badge key={g.id} variant="outline">{g.name}</Badge>
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
              {student.parents_number && (
                <>
                  <InfoRow label="Ota-ona telefon" value={student.parents_number} />
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
              {student.class_number && (
                <>
                  <InfoRow label="Sinf" value={`${student.class_number.number}-sinf`} />
                  <Separator />
                </>
              )}
              {student.shift && (
                <>
                  <InfoRow label="Smena" value={`${student.shift}-smena`} />
                  <Separator />
                </>
              )}
              {u.face_id && (
                <InfoRow label="Face ID" value={<code className="text-xs bg-muted px-1.5 py-0.5 rounded">{u.face_id}</code>} />
              )}
              {u.comment && (
                <>
                  <Separator />
                  <InfoRow label="Izoh" value={u.comment} />
                </>
              )}
            </div>

            <Separator className="mt-3 mb-3" />

            {/* Balance */}
            <div className={`rounded-lg p-3 ${hasDebt ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className={`h-4 w-4 ${hasDebt ? "text-red-500" : "text-green-500"}`} />
                <span className="text-sm font-medium">Balans</span>
              </div>
              <p className={`text-lg font-bold ${hasDebt ? "text-red-600" : "text-green-600"}`}>
                {hasDebt
                  ? `-${fmt(Math.abs(balance))} so'm`
                  : balance > 0
                    ? `+${fmt(balance)} so'm`
                    : "0 so'm"}
              </p>
            </div>

            {/* Charity */}
            {charity && (
              <div className="rounded-lg p-3 bg-blue-50 border border-blue-200 mt-3">
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Chegirma</span>
                </div>
                <p className="text-lg font-bold text-blue-600">{fmt(charity.charity_sum)} so'm</p>
                {charity.name && <p className="text-xs text-blue-500 mt-0.5">{charity.name}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Right — tabs */}
        <div className="lg:col-span-2 overflow-y-auto">
          <Tabs defaultValue="info">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto mb-4">
              <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <User className="h-3.5 w-3.5 mr-1.5" /> Ma'lumotlar
              </TabsTrigger>
              <TabsTrigger value="payments" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <FileText className="h-3.5 w-3.5 mr-1.5" /> To'lovlar
                {unpaidCount > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0 h-4">{unpaidCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="timetable" className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                <Clock className="h-3.5 w-3.5 mr-1.5" /> Dars jadvali
              </TabsTrigger>
            </TabsList>

            {/* Info tab */}
            <TabsContent value="info" className="space-y-4">
              {student.groups.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Sinflar</h3>
                  <div className="space-y-2">
                    {student.groups.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/school/groups/${g.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          {g.color && (
                            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                          )}
                          <span className="text-sm font-medium">{g.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{g.class_number}-sinf</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {student.subjects.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Fanlar</h3>
                  <div className="space-y-2">
                    {student.subjects.map((s) => (
                      <div key={s.id} className="py-2 px-3 rounded-md bg-muted/30 text-sm">{s.name}</div>
                    ))}
                  </div>
                </div>
              )}

              {student.groups.length === 0 && student.subjects.length === 0 && (
                <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                  Ma'lumot topilmadi
                </div>
              )}
            </TabsContent>

            {/* Payments tab */}
            <TabsContent value="payments" className="space-y-4">
              {/* Summary row */}
              {paymentRows.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Jami oylar</p>
                    <p className="text-xl font-bold">{paymentRows.length}</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center bg-green-50 border-green-200">
                    <p className="text-xs text-green-600 mb-1">To'langan</p>
                    <p className="text-xl font-bold text-green-600">{paidCount}</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center bg-red-50 border-red-200">
                    <p className="text-xs text-red-600 mb-1">To'lanmagan</p>
                    <p className="text-xl font-bold text-red-600">{unpaidCount}</p>
                  </div>
                </div>
              )}

              {/* Payment months table */}
              {paymentRows.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Oy</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Umumiy</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Chegirma</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">To'langan</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Qoldiq</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Holat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRows.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            {row.monthName}
                            {row.year && <span className="text-xs text-muted-foreground ml-1">{row.year}</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmt(row.total_debt)}</td>
                          <td className="px-4 py-3 text-right text-blue-600">
                            {row.discount > 0 ? `-${fmt(row.discount)}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-green-600">
                            {row.payment > 0 ? fmt(row.payment) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {row.remaining_debt > 0
                              ? <span className="text-red-600">{fmt(row.remaining_debt)}</span>
                              : <span className="text-muted-foreground">0</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.status
                              ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              : <XCircle className="h-4 w-4 text-red-400 mx-auto" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                  To'lov ma'lumotlari topilmadi
                </div>
              )}

              {/* Registered payment months */}
              {paymentMonths.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Oylik to'lov (ro'yxatga olingan)</h3>
                  <div className="flex flex-wrap gap-2">
                    {paymentMonths.map((m) => (
                      <div key={m.id} className="flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-sm">
                        <span className="font-medium">{MONTH_UZ[m.name] ?? m.name}</span>
                        <span className="text-muted-foreground text-xs">—</span>
                        <span className="text-primary font-semibold">{fmt(m.price)} so'm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Timetable tab */}
            <TabsContent value="timetable">
              {timetable && timetable.time_tables.length > 0 ? (
                <div className="border rounded-lg overflow-auto max-h-[calc(100vh-260px)]">
                  <table className="text-xs border-collapse" style={{ minWidth: "max-content" }}>
                    <thead className="sticky top-0 z-20">
                      <tr>
                        <th className="border-r border-b bg-card px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap sticky left-0 z-30 min-w-[120px]">
                          Vaqt
                        </th>
                        {timetable.time_tables.map((day, i) => (
                          <th key={i} className="border-r last:border-r-0 border-b bg-card px-3 py-2.5 text-center font-medium min-w-[150px]">
                            <div className="font-semibold">{day.weekday}</div>
                            <div className="text-muted-foreground font-normal mt-0.5">
                              {new Date(day.date).toLocaleDateString("uz-UZ")}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timetable.hours_list.map((hour) => {
                        const rowCells = timetable.time_tables.map((day) => {
                          const lessons: TimetableLesson[] = [];
                          day.rooms.forEach((room) => {
                            room.lessons.forEach((lesson) => {
                              if (lesson.status && lesson.hours === hour.id) {
                                lessons.push(lesson);
                              }
                            });
                          });
                          return lessons;
                        });

                        return (
                          <tr key={hour.id} className="border-b last:border-0">
                            <td className="border-r bg-card px-3 py-2.5 font-medium whitespace-nowrap sticky left-0 z-10">
                              <div>{hour.name}</div>
                              <div className="text-muted-foreground font-normal mt-0.5">
                                {hour.start_time} – {hour.end_time}
                              </div>
                            </td>
                            {rowCells.map((lessons, di) => (
                              <td key={di} className="border-r last:border-r-0 px-2 py-2 align-top">
                                {lessons.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {lessons.map((lesson, li) => (
                                      <div key={li} className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5">
                                        {lesson.subject && (
                                          <div className="font-semibold text-primary leading-tight">{lesson.subject.name}</div>
                                        )}
                                        {lesson.teacher && (
                                          <div className="text-muted-foreground mt-0.5">
                                            {lesson.teacher.name} {lesson.teacher.surname}
                                          </div>
                                        )}
                                        {lesson.room && (
                                          <div className="text-muted-foreground">{lesson.room.name}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12 text-sm border rounded-lg">
                  Dars jadvali mavjud emas
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
