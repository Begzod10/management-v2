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
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

// Active / new-registered students (same shape)
interface ActiveStudent {
  id: number;
  user: {
    id: number;
    name: string;
    surname: string;
    phone: string | null;
    age: number | null;
    registered_date: string;
    language: string | null;
  };
  group: {
    id: number | null;
    name: string | null;
    class_number: number | null;
    color: string | null;
  };
  debt: string | null;
  class_number: number | null;
  comment: string | null;
  face_id: string | null;
}

// Deleted-group students
interface DeletedStudent {
  id: number;
  student: {
    id: number;
    name: string;
    surname: string;
    age: number;
    phone: string;
    registered_date: string;
  };
  group: {
    id: number;
    name: string;
  };
  group_reason: {
    id: number;
    name: string;
  };
  deleted_date: string;
  comment: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 50;


// ─── Filters type ─────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  branch: string;
  language: string;
  age: string;
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

function useLanguages() {
  const [languages, setLanguages] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    apiFetch("/turon/language")
      .then((r) => r.json())
      .then((d) => setLanguages(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => {});
  }, []);
  return languages;
}

function useList<T>(endpoint: string, filters: Filters, offset: number) {
  const [data, setData] = useState<T[]>([]);
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
        });
        if (filters.search)   params.set("search",   filters.search);
        if (filters.branch)   params.set("branch",   filters.branch);
        if (filters.language) params.set("language", filters.language);
        if (filters.age)      params.set("age",      filters.age);
        const res = await apiFetch(`${endpoint}?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) {
          setData(json.results ?? []);
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
  }, [endpoint, filters.search, filters.branch, filters.language, filters.age, offset]);

  return { data, count, loading };
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  count,
  offset,
  onOffsetChange,
}: {
  count: number;
  offset: number;
  onOffsetChange: (o: number) => void;
}) {
  const totalPages = Math.ceil(count / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
      <span>
        {offset + 1}–{Math.min(offset + LIMIT, count)} / {count}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage === 1}
          onClick={() => onOffsetChange(offset - LIMIT)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 py-1 border rounded-md bg-muted text-xs font-medium">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage === totalPages}
          onClick={() => onOffsetChange(offset + LIMIT)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Shared loading / empty states ───────────────────────────────────────────

function LoadingRow() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyRow() {
  return (
    <p className="text-center text-sm text-muted-foreground py-12">
      O'quvchilar topilmadi
    </p>
  );
}

// ─── Active students table ────────────────────────────────────────────────────

function ActiveTable({ students, loading }: { students: ActiveStudent[]; loading: boolean }) {
  const navigate = useNavigate();
  if (loading) return <LoadingRow />;
  if (!students.length) return <EmptyRow />;

  return (
    <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-300px)]">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b sticky top-0 z-10">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">To'liq ism</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Yosh</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Telefon</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Guruh</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Til</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Ro'yxat sanasi</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id} onClick={() => navigate(`/school/students/${s.id}`)} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{s.user.name} {s.user.surname}</td>
              <td className="px-4 py-3">{s.user.age ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.user.phone ?? "—"}</td>
              <td className="px-4 py-3">
                {s.group.name ? <Badge variant="outline">{s.group.name}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{s.user.language ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {new Date(s.user.registered_date).toLocaleDateString("uz-UZ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Deleted-group students table ─────────────────────────────────────────────

function DeletedTable({ students, loading }: { students: DeletedStudent[]; loading: boolean }) {
  const navigate = useNavigate();
  if (loading) return <LoadingRow />;
  if (!students.length) return <EmptyRow />;

  return (
    <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-300px)]">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b sticky top-0 z-10">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">To'liq ism</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Yosh</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Telefon</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Guruh</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sabab</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">O'chirilgan sana</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={s.id} onClick={() => navigate(`/school/students/${s.student.id}`)} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{s.student.name} {s.student.surname}</td>
              <td className="px-4 py-3">{s.student.age}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.student.phone}</td>
              <td className="px-4 py-3"><Badge variant="outline">{s.group.name}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{s.group_reason.name}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {new Date(s.deleted_date).toLocaleDateString("uz-UZ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Attendance (Davomat) ─────────────────────────────────────────────────────

interface AttendanceStudent {
  id: number;
  name: string;
  surname: string;
  status: boolean;
}

interface AttendanceGroup {
  group_id: number;
  group_name: string;
  students: AttendanceStudent[];
  summary: { present: number; absent: number; total: number };
}

interface AttendanceData {
  branch_id: number;
  date: string;
  groups: AttendanceGroup[];
  overall_summary: { present: number; absent: number; total: number };
}

function useAttendance(branchId: string, date: string) {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchId || !date) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [year, month, day] = date.split("-");
        const params = new URLSearchParams({ day, month, year });
        const res = await apiFetch(`/turon/attendance/branch-daily/${branchId}?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) toast.error("Davomatni yuklashda xatolik");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [branchId, date]);

  return { data, loading };
}

function AttendanceTab({ branchId, branches }: { branchId: string; branches: { id: number; name: string }[] }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(todayStr);
  const [selectedBranch, setSelectedBranch] = useState(branchId);

  useEffect(() => { setSelectedBranch(branchId); }, [branchId]);

  const { data, loading } = useAttendance(selectedBranch, date);

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Select value={selectedBranch || "__none__"} onValueChange={(v) => setSelectedBranch(v === "__none__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filial tanlang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Filial tanlang</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {data && (
          <div className="flex items-center gap-3 ml-auto text-sm">
            <span className="text-green-600 font-medium">✓ {data.overall_summary.present} keldi</span>
            <span className="text-red-500 font-medium">✗ {data.overall_summary.absent} kelmadi</span>
            <span className="text-muted-foreground">Jami: {data.overall_summary.total}</span>
          </div>
        )}
      </div>

      {!selectedBranch ? (
        <p className="text-center text-sm text-muted-foreground py-12">Davomatni ko'rish uchun filial tanlang</p>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.groups?.length ? (
        <p className="text-center text-sm text-muted-foreground py-12">Ma'lumot topilmadi</p>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100vh-210px)] space-y-3">
          {data.groups.map((group) => (
            <div key={group.group_id} className="border rounded-lg overflow-hidden">
              {/* Group header */}
              <div className="bg-muted px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium">{group.group_name}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-green-600 font-medium">{group.summary.present} keldi</span>
                  <span className="text-red-500 font-medium">{group.summary.absent} kelmadi</span>
                  <span className="text-muted-foreground">Jami: {group.summary.total}</span>
                </div>
              </div>
              {/* Students */}
              <table className="w-full text-sm">
                <tbody>
                  {group.students.map((s, i) => (
                    <tr key={s.id} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground w-10">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">{s.name} {s.surname}</td>
                      <td className="px-4 py-2 text-right pr-6">
                        <div
                          className="w-3 h-3 rounded-full inline-block"
                          style={{ backgroundColor: s.status ? "#4CAF50" : "#ef4444" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab wrappers ─────────────────────────────────────────────────────────────

function ActiveTab({ filters }: { filters: Filters }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [filters.search, filters.branch, filters.language, filters.age]);
  const { data, count, loading } = useList<ActiveStudent>("/turon/students/active", filters, offset);
  return (
    <>
      <ActiveTable students={data} loading={loading} />
      <Pagination count={count} offset={offset} onOffsetChange={setOffset} />
    </>
  );
}

function DeletedTab({ filters }: { filters: Filters }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [filters.search, filters.branch, filters.language, filters.age]);
  const { data, count, loading } = useList<DeletedStudent>("/turon/students/deleted-group", filters, offset);
  return (
    <>
      <DeletedTable students={data} loading={loading} />
      <Pagination count={count} offset={offset} onOffsetChange={setOffset} />
    </>
  );
}

function NewTab({ filters }: { filters: Filters }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [filters.search, filters.branch, filters.language, filters.age]);
  const { data, count, loading } = useList<ActiveStudent>("/turon/students/new-registered", filters, offset);
  return (
    <>
      <ActiveTable students={data} loading={loading} />
      <Pagination count={count} offset={offset} onOffsetChange={setOffset} />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Section = "students" | "attendance";
type StudentSub = "active" | "new" | "deleted";

export default function SchoolStudentsPage() {
  const { user } = useAuth();
  const isSpiritualist = user?.role === "spiritualist";
  const branches = useBranches();
  const languages = useLanguages();

  const [section, setSection] = useState<Section>("students");
  const [studentSub, setStudentSub] = useState<StudentSub>("active");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [language, setLanguage] = useState("");
  const [age, setAge] = useState("");
  const [debouncedAge, setDebouncedAge] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAge(age), 400);
    return () => clearTimeout(t);
  }, [age]);

  const filters: Filters = {
    search: debouncedSearch,
    branch,
    language,
    age: debouncedAge,
  };

  const hasFilters = !!(search || branch || language || age);

  return (
    <DashboardLayout title="O'quvchilar">
      {/* Top: section buttons */}
      <div className="flex items-center gap-1 mb-3">
        <Button
          variant={section === "students" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("students")}
        >
          O'quvchilar
        </Button>
        <Button
          variant={section === "attendance" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSection("attendance")}
        >
          Davomat
        </Button>
      </div>

      {section === "students" && (
        <>
          {/* Filters + sub-section buttons */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Qidirish..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

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

            <Select value={language || "__all__"} onValueChange={(v) => setLanguage(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Til" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Barcha tillar</SelectItem>
                {languages.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="Yosh"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-[100px]"
              min={0}
            />

            {hasFilters && (
              <Button variant="ghost" size="sm"
                onClick={() => { setSearch(""); setBranch(""); setLanguage(""); setAge(""); }}>
                Tozalash
              </Button>
            )}
          </div>

          {/* Sub-section buttons */}
          <div className="flex items-center gap-1 mb-4">
            <Button
              variant={studentSub === "active" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStudentSub("active")}
            >
              Faol
            </Button>
            {!isSpiritualist && (
              <Button
                variant={studentSub === "new" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStudentSub("new")}
              >
                Yangi
              </Button>
            )}
            <Button
              variant={studentSub === "deleted" ? "default" : "ghost"}
              size="sm"
              onClick={() => setStudentSub("deleted")}
            >
              O'chirilgan
            </Button>
          </div>

          {studentSub === "active"  && <ActiveTab filters={filters} />}
          {studentSub === "new"     && !isSpiritualist && <NewTab filters={filters} />}
          {studentSub === "deleted" && <DeletedTab filters={filters} />}
        </>
      )}

      {section === "attendance" && (
        <AttendanceTab branchId={branch} branches={branches} />
      )}
    </DashboardLayout>
  );
}
