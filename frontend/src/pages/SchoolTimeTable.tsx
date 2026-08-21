import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NamedEntity { id: number; name: string; }

interface TimetableGroup {
  id: number;
  name: string;
  classes?: number[];
}

interface TimetableLesson {
  id?: number;
  status: boolean;
  is_flow: boolean;
  hours: number;
  room: number;
  group: TimetableGroup | Record<string, never>;
  teacher: NamedEntity | Record<string, never>;
  subject: NamedEntity | Record<string, never>;
}

interface TimetableRoom {
  id: number;
  name: string;
  order: number | null;
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

function hasId(obj: NamedEntity | Record<string, never>): obj is NamedEntity {
  return "id" in obj && typeof obj.id === "number";
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useBranches() {
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    apiFetch("/turon/branches")
      .then((r) => r.json())
      .then((d) => setBranches(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);
  return branches;
}

// ─── Lesson cell ──────────────────────────────────────────────────────────────

const FLOW_COLOR  = "bg-blue-500 border-blue-700";
const CLASS_COLOR = "bg-green-500 border-green-700";

function LessonCell({ lesson }: { lesson: TimetableLesson }) {
  const subject = hasId(lesson.subject) ? lesson.subject : null;
  const group   = "id" in lesson.group  ? lesson.group as TimetableGroup : null;
  const teacher = hasId(lesson.teacher) ? lesson.teacher : null;
  const color   = lesson.is_flow ? FLOW_COLOR : CLASS_COLOR;

  return (
    <div className={`rounded border text-white px-1.5 py-1 text-[10px] leading-tight ${color}`}>
      <div className="font-semibold truncate">{group?.name ?? "—"}</div>
      {subject && <div className="truncate opacity-90 mt-0.5">{subject.name}</div>}
      {teacher && <div className="truncate opacity-80">{teacher.name}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function SchoolTimeTablePage() {
  const branches = useBranches();
  const [branch, setBranch] = useState("");
  const [date, setDate] = useState(todayISO);
  const [timetable, setTimetable] = useState<TimetableResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branch) { setTimetable(null); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/turon/timetable/lessons?branch=${branch}&date=${date}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (!cancelled) setTimetable(data?.time_tables ? data : null); })
      .catch(() => { if (!cancelled) toast.error("Xatolik yuz berdi"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branch, date]);

  const day = timetable?.time_tables?.[0] ?? null;
  const hours = timetable?.hours_list ?? [];

  // Build lookup: roomId → hourId → lesson
  const lessonMap = new Map<number, Map<number, TimetableLesson>>();
  if (day) {
    for (const room of day.rooms) {
      const byHour = new Map<number, TimetableLesson>();
      for (const lesson of room.lessons) {
        if (lesson.status) byHour.set(lesson.hours, lesson);
      }
      lessonMap.set(room.id, byHour);
    }
  }

  return (
    <DashboardLayout title="Dars jadvali">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <Select value={branch || "__none__"} onValueChange={(v) => setBranch(v === "__none__" ? "" : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filial tanlang..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" disabled>Filial tanlang...</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayISO())}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {day && (
            <span className="text-sm text-muted-foreground">
              {day.weekday}, {new Date(day.date).toLocaleDateString("uz-UZ")}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !branch ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Dars jadvalini ko'rish uchun filial tanlang
            </div>
          ) : !day ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Dars jadvali mavjud emas
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto h-full w-full">
              <table className="text-xs border-collapse" style={{ minWidth: `${120 + hours.length * 130}px` }}>
                <thead className="sticky top-0 z-20">
                  <tr>
                    {/* Corner cell */}
                    <th className="border-r border-b bg-muted px-3 py-2.5 text-left text-muted-foreground sticky left-0 z-30 min-w-[140px] font-medium">
                      Xona
                    </th>
                    {hours.map((h) => (
                      <th key={h.id} className="border-r last:border-r-0 border-b bg-muted px-2 py-2 text-center font-medium min-w-[120px]">
                        <div>{h.start_time.slice(0, 5)}–{h.end_time.slice(0, 5)}</div>
                        <div className="text-muted-foreground font-normal text-[10px] mt-0.5">{h.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {day.rooms.map((room) => (
                    <tr key={room.id} className="border-b last:border-0">
                      {/* Room name — sticky left */}
                      <td className="border-r bg-card px-3 py-2 font-medium sticky left-0 z-10 whitespace-nowrap">
                        {room.name}
                      </td>
                      {hours.map((h) => {
                        const lesson = lessonMap.get(room.id)?.get(h.id);
                        return (
                          <td key={h.id} className="border-r last:border-r-0 px-1.5 py-1.5 align-top min-w-[120px]">
                            {lesson && <LessonCell lesson={lesson} />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
