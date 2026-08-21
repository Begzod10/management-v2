import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group {
  id: number;
  name: string;
  teacher: string;
  status: boolean;
  count: number;
  class_number: number;
  color: string;
  price: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 50;

const COLOR_MAP: Record<string, string> = {
  green:  "#4CAF50",
  blue:   "#2196F3",
  red:    "#F44336",
  yellow: "#FFC107",
  purple: "#9C27B0",
  orange: "#FF9800",
  black:  "#607D8B",
};

function colorDot(name: string) {
  return COLOR_MAP[name?.toLowerCase()] ?? "#94a3b8";
}

function fmtPrice(price: number | null) {
  if (price == null) return "—";
  return price.toLocaleString("uz-UZ") + " so'm";
}

// ─── Filters ──────────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  branch: string;
  teacher: string;
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

function useTeachers(branch: string) {
  const [teachers, setTeachers] = useState<{ id: number; name: string; surname: string }[]>([]);
  useEffect(() => {
    const params = new URLSearchParams({ limit: "200", deleted: "false" });
    if (branch) params.set("branch", branch);
    apiFetch(`/turon/teachers/?${params}`)
      .then((r) => r.json())
      .then((d) => setTeachers(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => {});
  }, [branch]);
  return teachers;
}

function useGroups(deleted: boolean, filters: Filters, offset: number) {
  const [data, setData] = useState<Group[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(offset),
          deleted: String(deleted),
        });
        if (filters.search)  params.set("search",  filters.search);
        if (filters.branch)  params.set("branch",  filters.branch);
        if (filters.teacher) params.set("teacher", filters.teacher);

        const res = await apiFetch(`/turon/group/classes?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) {
          setData(json.results ?? json ?? []);
          setCount(json.count ?? 0);
        }
      } catch {
        if (!cancelled) toast.error("Ma'lumotlarni yuklashda xatolik");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [deleted, filters.search, filters.branch, filters.teacher, offset]);

  return { data, count, loading };
}


// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  count, offset, onOffsetChange,
}: {
  count: number; offset: number; onOffsetChange: (o: number) => void;
}) {
  const totalPages = Math.ceil(count / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
      <span>{offset + 1}–{Math.min(offset + LIMIT, count)} / {count}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={currentPage === 1} onClick={() => onOffsetChange(offset - LIMIT)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 py-1 border rounded-md bg-muted text-xs font-medium">
          {currentPage} / {totalPages}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8"
          disabled={currentPage === totalPages} onClick={() => onOffsetChange(offset + LIMIT)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function GroupTable({ groups, loading }: { groups: Group[]; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!groups.length) {
    return <p className="text-center text-sm text-muted-foreground py-12">Sinflar topilmadi</p>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-300px)]">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b sticky top-0 z-10">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sinf</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">O'qituvchi</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sinf raqami</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">O'quvchilar</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Narx</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Holat</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.id}
              onClick={() => navigate(`/school/groups/${g.id}`)}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorDot(g.color) }} />
                  <span className="font-medium">{g.name || "—"}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{g.teacher}</td>
              <td className="px-4 py-3">
                <Badge variant="secondary" className="text-xs">{g.class_number}-sinf</Badge>
              </td>
              <td className="px-4 py-3">{g.count} ta</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtPrice(g.price)}</td>
              <td className="px-4 py-3">
                <Badge variant={g.status ? "default" : "secondary"}
                  className={g.status ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : ""}>
                  {g.status ? "Faol" : "Nofaol"}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Time List (Hours) ────────────────────────────────────────────────────────

interface HourItem {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  order: number;
}

function useHoursList(branch: string, search: string, offset: number) {
  const [data, setData] = useState<HourItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "20", offset: String(offset) });
    if (branch) params.set("branch", branch);
    if (search)  params.set("search", search);
    apiFetch(`/turon/timetable/hours?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(Array.isArray(d) ? d : (d?.results ?? []));
          setCount(typeof d?.count === "number" ? d.count : 0);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branch, search, offset]);
  return { data, count, loading };
}

function TimeListSection({
  branch, setBranch, branches,
}: {
  branch: string;
  setBranch: (v: string) => void;
  branches: { id: number; name: string }[];
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setOffset(0); }, [branch, debouncedSearch]);

  const { data, count, loading } = useHoursList(branch, debouncedSearch, offset);

  const totalPages = Math.ceil(count / 20);
  const currentPage = Math.floor(offset / 20) + 1;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={branch || "__all__"} onValueChange={(v) => setBranch(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha filiallar</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Qidirish..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Ma'lumot topilmadi</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nomi</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-[130px]">Boshlanish</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-[130px]">Tugash</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-[80px]">Tartib</th>
                </tr>
              </thead>
              <tbody>
                {(data as HourItem[]).map((h, i) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{offset + i + 1}</td>
                    <td className="px-4 py-3 font-medium">{h.name}</td>
                    <td className="px-4 py-3 text-center">{h.start_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 text-center">{h.end_time.slice(0, 5)}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{h.order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>{offset + 1}–{Math.min(offset + 20, count)} / {count}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={currentPage === 1} onClick={() => setOffset(offset - 20)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-3 py-1 border rounded-md bg-muted text-xs font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8"
                  disabled={currentPage === totalPages} onClick={() => setOffset(offset + 20)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Imtihonlar ───────────────────────────────────────────────────────────────

interface ExamResult {
  id: number;
  title: string;
  score: number;
  datetime: string;
  student: number;
  student_name: string;
  student_surname: string;
  teacher: number;
  teacher_name: string;
  teacher_surname: string;
  group: number;
  group_name: string;
  subject: number;
  subject_name: string;
}

function useExamResults(filters: {
  teacher: string; group: string; student: string;
  subject: string; year: string; month: string;
}) {
  const [data, setData] = useState<ExamResult[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.teacher) params.set("teacher", filters.teacher);
    if (filters.group)   params.set("group",   filters.group);
    if (filters.student) params.set("student", filters.student);
    if (filters.subject) params.set("subject", filters.subject);
    if (filters.year)    params.set("year",    filters.year);
    if (filters.month)   params.set("month",   filters.month);
    apiFetch(`/turon/students/student-exam-results?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(Array.isArray(d) ? d : (d?.results ?? []));
          setCount(typeof d?.count === "number" ? d.count : 0);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.teacher, filters.group, filters.student, filters.subject, filters.year, filters.month]);
  return { data, count, loading };
}

function ImtihonlarSection({
  branch, setBranch, branches,
}: {
  branch: string;
  setBranch: (v: string) => void;
  branches: { id: number; name: string }[];
}) {
  const teachers = useTeachers(branch);
  const [teacher, setTeacher] = useState("");
  const [group,   setGroup]   = useState("");
  const [subject, setSubject] = useState("");
  const [year,    setYear]    = useState(String(new Date().getFullYear()));
  const [month,   setMonth]   = useState(String(new Date().getMonth() + 1));

  useEffect(() => { setTeacher(""); setGroup(""); }, [branch]);

  const { data, loading } = useExamResults({ teacher, group, student: "", subject, year, month });

  const months = [
    "Yanvar","Fevral","Mart","Aprel","May","Iyun",
    "Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr",
  ];

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select value={branch || "__all__"} onValueChange={(v) => setBranch(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha filiallar</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={teacher || "__all__"} onValueChange={(v) => setTeacher(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="O'qituvchi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha o'qituvchilar</SelectItem>
            {teachers.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.surname}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2023,2024,2025,2026].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Natijalar topilmadi</p>
      ) : (
        <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-260px)]">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">O'quvchi</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">O'qituvchi</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sinf</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fan</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Imtihon</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-[90px]">Ball</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-[110px]">Sana</th>
              </tr>
            </thead>
            <tbody>
              {(data as ExamResult[]).map((r, i) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.student_name} {r.student_surname}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.teacher_name} {r.teacher_surname}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.group_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.subject_name}</td>
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 text-center font-semibold">{r.score}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                    {new Date(r.datetime).toLocaleDateString("uz-UZ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Class Colors ─────────────────────────────────────────────────────────────

interface ClassColor { id: number; name: string; value: string; }

function useClassColors() {
  const [data, setData] = useState<ClassColor[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch("/turon/class/class-colors")
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

// ─── Class Types ──────────────────────────────────────────────────────────────

interface ClassNumber { id: number; status: boolean; number: number; }
interface ClassType   { id: number; name: string; class_numbers: ClassNumber[]; }

function useClassTypes(branch: string) {
  const [data, setData] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!branch) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/turon/class/class-types?branch=${branch}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(Array.isArray(d) ? d : (d?.results ?? [])); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branch]);
  return { data, loading };
}

interface ClassGroupSubject {
  subject_id: number;
  subject: string;
  hours: number;
  count: number | null;
}

interface ClassGroup {
  id: number;
  class_number: number;
  color: string;
  class_type: string;
  price: number;
  subjects: ClassGroupSubject[];
  status_class_type: boolean;
  overall_hours: number;
}

function useGroupsByClassType(branchId: string, classTypeId: number | null) {
  const [data, setData] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!branchId || !classTypeId) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/turon/group/groups-by-class-type?branch_id=${branchId}&class_type_id=${classTypeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(Array.isArray(d) ? d : (d?.data ?? d?.results ?? []));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchId, classTypeId]);
  return { data, loading };
}

function ClassTypesSection({
  branch, setBranch, branches,
}: {
  branch: string;
  setBranch: (v: string) => void;
  branches: { id: number; name: string }[];
}) {
  const { data: types, loading: typesLoading } = useClassTypes(branch);
  const { data: colors, loading: colorsLoading } = useClassColors();
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [showColors, setShowColors] = useState(false);

  useEffect(() => {
    if (types.length > 0 && !selectedTypeId) setSelectedTypeId(types[0].id);
  }, [types, selectedTypeId]);
  useEffect(() => { setSelectedTypeId(null); }, [branch]);

  const { data: groups, loading: groupsLoading } = useGroupsByClassType(branch, selectedTypeId);

  // View toggle — same row as branch select (rendered in parent), so we expose it via a top bar
  return (
    <div className="flex flex-col min-h-0">
      {/* Branch select + toggle on one row */}
      <div className="flex items-center justify-between mb-3 shrink-0 gap-3">
        <Select value={branch || "__all__"} onValueChange={(v) => setBranch(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha filiallar</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button
          variant={showColors ? "default" : "outline"}
          size="sm"
          onClick={() => setShowColors((v) => !v)}
        >
          {showColors ? "Ranglar" : "Ranglar"}
        </Button>
      </div>

      {showColors ? (
        /* ── Colors view ── */
        colorsLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {colors.map((c) => (
              <div key={c.id} className="border rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full shrink-0 border" style={{ backgroundColor: c.value }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.value}</div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Class types view ── */
        <>
          {!branch ? (
            <p className="text-center text-sm text-muted-foreground py-12">Ko'rish uchun filialni tanlang</p>
          ) : typesLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Type header bar */}
              <div className="border rounded-lg overflow-hidden mb-4 shrink-0">
                <div className="grid text-sm" style={{ gridTemplateColumns: `repeat(${types.length}, 1fr)` }}>
                  {types.map((type) => {
                    const sorted = [...type.class_numbers].sort((a, b) => a.number - b.number);
                    const isSelected = selectedTypeId === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedTypeId(type.id)}
                        className={`flex flex-col items-center gap-1 px-3 py-3 border-r last:border-r-0 transition-colors text-center
                          ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted/40 hover:bg-muted text-foreground"}`}
                      >
                        <span className="font-medium text-xs leading-tight">{type.name}</span>
                        <span className={`text-[11px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {sorted.map((cn) => cn.number).join(" ")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Groups table */}
              {groupsLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : groups.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-12">Sinflar topilmadi</p>
              ) : (
                <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-300px)]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted border-b sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sinf</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fanlari</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground w-[120px]">Umumiy soati</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground w-[130px]">Narxi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...groups]
                        .sort((a, b) => a.class_number - b.class_number || a.color.localeCompare(b.color))
                        .map((g, i) => (
                          <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorDot(g.color) }} />
                                <span className="font-medium">{g.class_number}-{g.color}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {g.subjects.map((s) => (
                                  <span key={s.subject_id} className="inline-flex items-center gap-0.5 text-[11px] bg-muted rounded px-1.5 py-0.5">
                                    {s.subject}<span className="text-muted-foreground">·{s.hours}h</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">{g.overall_hours}h</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{fmtPrice(g.price)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Flow List ────────────────────────────────────────────────────────────────

interface FlowItem {
  id: number;
  name: string;
  activity: boolean;
  classes: number[];
  subject_name: string | null;
  teacher_name: string | null;
  teacher_surname: string | null;
  student_count: number;
  level_name: string | null;
  branch_name: string;
}

function useFlowList(branch: string, offset: number) {
  const [data, setData] = useState<FlowItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
        if (branch) params.set("branch", branch);
        const res = await apiFetch(`/turon/flow/flow-list?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) {
          setData(json.results ?? json ?? []);
          setCount(json.count ?? 0);
        }
      } catch {
        if (!cancelled) toast.error("Flow listni yuklashda xatolik");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [branch, offset]);

  return { data, count, loading };
}

function FlowTable({ items, loading }: { items: FlowItem[]; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items.length) {
    return <p className="text-center text-sm text-muted-foreground py-12">Flow topilmadi</p>;
  }

  return (
    <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-300px)]">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b sticky top-0 z-10">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nomi</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fan</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">O'qituvchi</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Studentlar</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Filial</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Level</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Holat</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id}
              onClick={() => navigate(`/school/flows/${item.id}`)}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{item.name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.subject_name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.teacher_name ? `${item.teacher_name} ${item.teacher_surname ?? ""}`.trim() : "—"}
              </td>
              <td className="px-4 py-3">{item.student_count}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.branch_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.level_name ?? "—"}</td>
              <td className="px-4 py-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.activity ? "#4CAF50" : "#94a3b8" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowListTab({ branch }: { branch: string }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [branch]);
  const { data, count, loading } = useFlowList(branch, offset);
  return (
    <>
      <FlowTable items={data} loading={loading} />
      <Pagination count={count} offset={offset} onOffsetChange={setOffset} />
    </>
  );
}

// ─── Tab wrappers ─────────────────────────────────────────────────────────────

function GroupsTab({ deleted, filters }: { deleted: boolean; filters: Filters }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [filters.search, filters.branch, filters.teacher]);
  const { data, count, loading } = useGroups(deleted, filters, offset);
  return (
    <>
      <GroupTable groups={data} loading={loading} />
      <Pagination count={count} offset={offset} onOffsetChange={setOffset} />
    </>
  );
}

function GroupsSection({
  branch, setBranch, branches, deleted, setDeleted,
}: {
  branch: string;
  setBranch: (v: string) => void;
  branches: { id: number; name: string }[];
  deleted: boolean;
  setDeleted: (v: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [teacher, setTeacher] = useState("");
  const teachers = useTeachers(branch);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const filters: Filters = { search: debouncedSearch, branch, teacher };
  const hasFilters = !!(search || branch || teacher);

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Qidirish..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>

        <Select value={branch || "__all__"} onValueChange={(v) => { setBranch(v === "__all__" ? "" : v); setTeacher(""); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha filiallar</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={teacher || "__all__"} onValueChange={(v) => setTeacher(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="O'qituvchi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha o'qituvchilar</SelectItem>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name} {t.surname}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm"
            onClick={() => { setSearch(""); setBranch(""); setTeacher(""); }}>
            Tozalash
          </Button>
        )}

        <div className="ml-auto">
          <Button variant={deleted ? "destructive" : "outline"} size="sm"
            onClick={() => setDeleted(!deleted)}>
            {deleted ? "O'chirilgan" : "Faol"}
          </Button>
        </div>
      </div>
      <GroupsTab deleted={deleted} filters={filters} />
    </>
  );
}


// ─── Chorak Baholari ──────────────────────────────────────────────────────────

interface AcademicYearItem { academic_year: string; }

interface Term {
  id: number;
  quarter: number;
  start_date: string;
  end_date: string;
  academic_year: string;
}

interface TableEntry {
  id: number;
  name: string;
  weight: number;
  date: string;
}

interface SubjectResult {
  id: number;
  title: string;
  type: "subject";
  tableData: TableEntry[];
}

interface GroupResult {
  id: number;
  title: string;
  type: "group";
  children: SubjectResult[];
}

function useAcademicYears() {
  const [years, setYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch("/turon/terms/education-years")
      .then((r) => r.json())
      .then((d) => {
        const arr: AcademicYearItem[] = Array.isArray(d) ? d : (d?.results ?? []);
        setYears(arr.map((item) => item.academic_year).sort());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { years, loading };
}

function useTerms(academicYear: string) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!academicYear) { setTerms([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/turon/terms/list-term/${encodeURIComponent(academicYear)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setTerms(Array.isArray(d) ? d : (d?.results ?? [])); })
      .catch(() => { if (!cancelled) toast.error("Choraklarni yuklashda xatolik"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [academicYear]);
  return { terms, loading };
}

function useListTest(termId: number | null, branch: string) {
  const [data, setData] = useState<GroupResult[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!termId || !branch) { setData([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch(`/turon/terms/list-test/${termId}/${branch}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(Array.isArray(d) ? d : (d?.results ?? [])); })
      .catch(() => { if (!cancelled) toast.error("Ma'lumotlarni yuklashda xatolik"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [termId, branch]);
  return { data, loading };
}

// Sort tableData: weight=30 entries by date asc (summative 1, 2), then weight=40 (final)
function sortTests(entries: TableEntry[]): [TableEntry | null, TableEntry | null, TableEntry | null] {
  const summatives = [...entries.filter((e) => e.weight < 40)].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const finals = entries.filter((e) => e.weight >= 40);
  return [summatives[0] ?? null, summatives[1] ?? null, finals[0] ?? null];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

function GroupTestTable({ group }: { group: GroupResult }) {
  const withData = group.children.filter((s) => s.tableData.length > 0).length;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-semibold text-sm">{group.title}</span>
        <span className="text-xs text-muted-foreground">
          ({withData}/{group.children.length} fan kiritilgan)
        </span>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fan</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[110px]">
                Summative 1 <span className="font-normal opacity-70">(30%)</span>
              </th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[110px]">
                Summative 2 <span className="font-normal opacity-70">(30%)</span>
              </th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[110px]">
                Final <span className="font-normal opacity-70">(40%)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {group.children.map((subj) => {
              const [s1, s2, fin] = sortTests(subj.tableData);
              return (
                <tr key={subj.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{subj.title}</td>
                  <td className="px-3 py-2 text-center">
                    {s1 ? (
                      <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-[11px]">
                        {fmtDate(s1.date)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {s2 ? (
                      <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-[11px]">
                        {fmtDate(s2.date)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fin ? (
                      <span className="inline-block bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5 text-[11px]">
                        {fmtDate(fin.date)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChorakBaholariSection({
  branch, setBranch, branches,
}: {
  branch: string;
  setBranch: (v: string) => void;
  branches: { id: number; name: string }[];
}) {
  const { years, loading: yearsLoading } = useAcademicYears();
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);

  useEffect(() => {
    if (years.length > 0 && !selectedYear) setSelectedYear(years[0]);
  }, [years, selectedYear]);

  const { terms, loading: termsLoading } = useTerms(selectedYear);

  useEffect(() => {
    if (terms.length > 0 && !selectedTermId) setSelectedTermId(terms[0].id);
  }, [terms, selectedTermId]);

  useEffect(() => { setSelectedTermId(null); }, [selectedYear]);

  const { data: testData, loading: testLoading } = useListTest(selectedTermId, branch);

  if (yearsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* All filters on one row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap shrink-0">
        {/* Branch */}
        <Select value={branch || "__all__"} onValueChange={(v) => setBranch(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filial" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha filiallar</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year */}
        <Select value={selectedYear || "__none__"} onValueChange={(v) => setSelectedYear(v === "__none__" ? "" : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="O'quv yili" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" disabled>O'quv yili</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quarter buttons */}
        {termsLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex gap-1">
            {terms.map((term) => (
              <Button
                key={term.id}
                variant={selectedTermId === term.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTermId(term.id)}
              >
                {term.quarter}-chorak
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {!selectedYear ? (
        <p className="text-center text-sm text-muted-foreground py-12">Ko'rish uchun o'quv yilini tanlang</p>
      ) : !branch ? (
        <p className="text-center text-sm text-muted-foreground py-12">Ko'rish uchun filialni tanlang</p>
      ) : testLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : testData.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Ma'lumot topilmadi</p>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100vh-210px)] pr-1">
          {[...testData]
            .sort((a, b) => (parseInt(a.title) || 0) - (parseInt(b.title) || 0))
            .map((group) => (
              <GroupTestTable key={group.id} group={group} />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SchoolGroupsPage() {
  const [branch, setBranch] = useState("");
  const [section, setSection] = useState<"groups" | "flow-list" | "class-types" | "time-list" | "imtihonlar" | "chorak-baholari">("groups");
  const [deleted, setDeleted] = useState(false);

  const branches = useBranches();

  return (
    <DashboardLayout title="Sinflar">
      {/* Section tabs */}
      <div className="flex items-center mb-3 gap-1 flex-wrap">
        <Button variant={section === "groups" ? "default" : "ghost"} size="sm" onClick={() => setSection("groups")}>
          Sinflar
        </Button>
        <Button variant={section === "flow-list" ? "default" : "ghost"} size="sm" onClick={() => setSection("flow-list")}>
          Flow List
        </Button>
        <Button variant={section === "class-types" ? "default" : "ghost"} size="sm" onClick={() => setSection("class-types")}>
          Sinf Raqamlari
        </Button>
        <Button variant={section === "time-list" ? "default" : "ghost"} size="sm" onClick={() => setSection("time-list")}>
          Time List
        </Button>
        <Button variant={section === "imtihonlar" ? "default" : "ghost"} size="sm" onClick={() => setSection("imtihonlar")}>
          Imtihonlar
        </Button>
        <Button variant={section === "chorak-baholari" ? "default" : "ghost"} size="sm" onClick={() => setSection("chorak-baholari")}>
          Chorak Baholari
        </Button>
      </div>

      {/* Branch filter for flow-list only */}
      {section === "flow-list" && (
        <div className="flex items-center gap-3 mb-4">
          <Select value={branch || "__all__"} onValueChange={(v) => setBranch(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filial" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Barcha filiallar</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {section === "groups" && (
        <GroupsSection
          branch={branch} setBranch={setBranch} branches={branches}
          deleted={deleted} setDeleted={setDeleted}
        />
      )}
      {section === "flow-list" && <FlowListTab branch={branch} />}
      {section === "class-types" && (
        <ClassTypesSection branch={branch} setBranch={setBranch} branches={branches} />
      )}
      {section === "time-list" && (
        <TimeListSection branch={branch} setBranch={setBranch} branches={branches} />
      )}
      {section === "imtihonlar" && (
        <ImtihonlarSection branch={branch} setBranch={setBranch} branches={branches} />
      )}
      {section === "chorak-baholari" && (
        <ChorakBaholariSection branch={branch} setBranch={setBranch} branches={branches} />
      )}
    </DashboardLayout>
  );
}
