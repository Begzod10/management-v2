import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayType {
  id?: number;
  type: string;
  color: string;
}

interface CalendarDay {
  id: number;
  day_number: number;
  day_name: string;
  type_id: DayType | null;
}

interface CalendarMonth {
  year: number;
  month_number: number;
  month_name: string;
  days: CalendarDay[];
  types: { type: string; color: string; days: CalendarDay[] }[];
}

interface CalendarYear {
  months: CalendarMonth[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const MONTH_NAMES = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const DEFAULT_TYPES: DayType[] = [
  { type: "Ish kuni", color: "green" },
  { type: "Dam", color: "red" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateCalendar(startYear: number): CalendarYear {
  const endYear = startYear + 1;
  const months: CalendarMonth[] = [];
  const order = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
  for (const m of order) {
    const y = m >= 9 ? startYear : endYear;
    const daysInMonth = new Date(y, m, 0).getDate();
    const days: CalendarDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;
      days.push({
        id: (m - 1) * 31 + d,
        day_number: d,
        day_name: DAY_NAMES_SHORT[dow === 0 ? 6 : dow - 1],
        type_id: {
          type: isWeekend ? "Dam" : "Ish kuni",
          color: isWeekend ? "red" : "green",
        },
      });
    }
    months.push({ year: y, month_number: m, month_name: MONTH_NAMES[m - 1], days, types: [] });
  }
  return { months };
}

function colorClass(color: string): string {
  const map: Record<string, string> = {
    green:  "bg-green-100 text-green-800 border-green-200",
    blue:   "bg-blue-100 text-blue-800 border-blue-200",
    red:    "bg-red-100 text-red-800 border-red-200",
    orange: "bg-orange-100 text-orange-800 border-orange-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return map[color] ?? "bg-muted text-muted-foreground border-muted";
}

function colorDot(color: string): string {
  const map: Record<string, string> = {
    green: "bg-green-500", blue: "bg-blue-500",
    red: "bg-red-500", orange: "bg-orange-500",
    yellow: "bg-yellow-500", purple: "bg-purple-500",
  };
  return map[color] ?? "bg-muted-foreground";
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

function MonthGrid({ month }: { month: CalendarMonth }) {
  const firstDow = new Date(month.year, month.month_number - 1, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;

  const cells: (CalendarDay | null)[] = [
    ...Array(offset).fill(null),
    ...month.days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 text-sm font-semibold border-b">
        {month.month_name}
      </div>
      <div className="p-2">
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES_SHORT.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) =>
            day ? (
              <div
                key={i}
                title={day.type_id?.type}
                className={`text-center text-xs py-1 rounded border font-medium ${
                  day.type_id ? colorClass(day.type_id.color) : "bg-muted text-muted-foreground border-muted"
                }`}
              >
                {day.day_number}
              </div>
            ) : (
              <div key={i} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function getAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const startYear = currentMonth >= 8 ? currentYear : currentYear - 1;
  return { startYear, endYear: startYear + 1 };
}

export default function SchoolCalendarPage() {
  const initial = getAcademicYear();
  const [startYear, setStartYear] = useState(initial.startYear);
  const endYear = startYear + 1;
  const [calendarData, setCalendarData] = useState<CalendarYear | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/calendar/${startYear}/${endYear}`);
      if (!res.ok) throw new Error("Failed to fetch calendar");
      const data = await res.json();
      const months: CalendarMonth[] = [];
      for (const yearObj of data.calendar) {
        for (const month of yearObj.months) {
          months.push({ ...month, year: yearObj.year });
        }
      }
      months.sort((a, b) => {
        const order = (m: number) => (m >= 9 ? m - 9 : m + 3);
        return order(a.month_number) - order(b.month_number);
      });
      setCalendarData({ months });
    } catch {
      toast.error("Kalendarni yuklashda xatolik");
      setCalendarData(generateCalendar(startYear));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [startYear]);

  const legend: DayType[] = calendarData
    ? Array.from(
        new Map(
          calendarData.months
            .flatMap((m) => m.types.map((t) => ({ type: t.type, color: t.color })))
            .map((t) => [t.type, t])
        ).values()
      )
    : DEFAULT_TYPES;

  return (
    <DashboardLayout title="Kalendar">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setStartYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold w-28 text-center">{startYear} / {endYear}</span>
          <Button variant="outline" size="icon" onClick={() => setStartYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {legend.map((t) => (
            <div key={t.type} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${colorDot(t.color)}`} />
              <span className="text-xs text-muted-foreground">{t.type}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : calendarData ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {calendarData.months.map((month) => (
            <MonthGrid
              key={`${month.year}-${month.month_number}`}
              month={month}
            />
          ))}
        </div>
      ) : null}
    </DashboardLayout>
  );
}
