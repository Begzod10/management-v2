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

interface SalaryType {
  id: number;
  name: string;
  salary: number;
  branch: { id: number; name: string } | null;
}

interface Teacher {
  id: number;
  user_id: number;
  name: string;
  surname: string;
  phone: string | null;
  username: string | null;
  age: number | null;
  face_id: string | null;
  color: string | null;
  deleted: boolean;
  status: boolean;
  subjects: { id: number; name: string }[];
}

interface Employee {
  id: number;
  user_id: number;
  name: string;
  phone: string | null;
  age: number | null;
  job: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 50;


// ─── Filters ──────────────────────────────────────────────────────────────────

interface TeacherFilters {
  search: string;
  branch: string;
  language: string;
  subject: string;
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

function useSubjects() {
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    apiFetch("/turon/subjects/subject")
      .then((r) => r.json())
      .then((d) => setSubjects(Array.isArray(d) ? d : (d?.results ?? [])))
      .catch(() => {});
  }, []);
  return subjects;
}

function useTeachers(deleted: boolean, filters: TeacherFilters, offset: number) {
  const [data, setData] = useState<Teacher[]>([]);
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
        if (filters.search)   params.set("search",   filters.search);
        if (filters.branch)   params.set("branch",   filters.branch);
        if (filters.language) params.set("language", filters.language);
        if (filters.subject)  params.set("subject",  filters.subject);
        if (filters.age)      params.set("age",      filters.age);
        const res = await apiFetch(`/turon/teachers/?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) { setData(json.results ?? []); setCount(json.count ?? 0); }
      } catch {
        if (!cancelled) toast.error("Ma'lumotlarni yuklashda xatolik");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [deleted, filters.search, filters.branch, filters.language, filters.subject, filters.age, offset]);

  return { data, count, loading };
}

function useEmployees(deleted: boolean, branch: string, offset: number) {
  const [data, setData] = useState<Employee[]>([]);
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
        if (branch) params.set("branch", branch);
        const res = await apiFetch(`/turon/users/employees?${params}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) { setData(json.results ?? json ?? []); setCount(json.count ?? 0); }
      } catch {
        if (!cancelled) toast.error("Ishchilarni yuklashda xatolik");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [deleted, branch, offset]);

  return { data, count, loading };
}

function useSalaryTypes(branch: string) {
  const [data, setData] = useState<SalaryType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (branch) params.set("branch", branch);
        const res = await apiFetch(`/turon/teachers/salary-types/${params.toString() ? `?${params}` : ""}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(Array.isArray(json) ? json : (json.results ?? []));
      } catch {
        if (!cancelled) toast.error("Toifalarni yuklashda xatolik");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [branch]);

  return { data, loading };
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

// ─── Subject badges ───────────────────────────────────────────────────────────

const MAX_VISIBLE = 2;

function SubjectBadges({ subjects }: { subjects: { id: number; name: string }[] }) {
  if (!subjects.length) return <span className="text-muted-foreground text-xs">—</span>;
  const visible = subjects.slice(0, MAX_VISIBLE);
  const rest = subjects.length - MAX_VISIBLE;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((s) => (
        <Badge key={s.id} variant="secondary" className="text-xs font-normal">{s.name}</Badge>
      ))}
      {rest > 0 && (
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">+{rest}</Badge>
      )}
    </div>
  );
}

// ─── Teacher table ────────────────────────────────────────────────────────────

function TeacherTable({ teachers, loading }: { teachers: Teacher[]; loading: boolean }) {
  const navigate = useNavigate();
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!teachers.length) return <p className="text-center text-sm text-muted-foreground py-12">O'qituvchilar topilmadi</p>;

  return (
    <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-270px)]">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b sticky top-0 z-10">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">To'liq ism</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Username</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Telefon</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Yosh</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fan</th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t, i) => (
            <tr key={t.id} onClick={() => navigate(`/school/teachers/${t.id}`)}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{t.name} {t.surname}</td>
              <td className="px-4 py-3 text-muted-foreground">{t.username ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{t.phone ?? "—"}</td>
              <td className="px-4 py-3">{t.age ?? "—"}</td>
              <td className="px-4 py-3"><SubjectBadges subjects={t.subjects} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Employee table ───────────────────────────────────────────────────────────

function EmployeeTable({ employees, loading }: { employees: Employee[]; loading: boolean }) {
  const navigate = useNavigate();
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!employees.length) return <p className="text-center text-sm text-muted-foreground py-12">Ishchilar topilmadi</p>;

  return (
    <div className="border rounded-lg overflow-hidden overflow-y-auto max-h-[calc(100vh-270px)]">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b sticky top-0 z-10">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">To'liq ism</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Telefon</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Yosh</th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Lavozim</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e, i) => (
            <tr key={e.id} onClick={() => navigate(`/school/employees/${e.id}`)}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
              <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3 font-medium">{e.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.phone ?? "—"}</td>
              <td className="px-4 py-3">{e.age ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.job ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Section wrappers ─────────────────────────────────────────────────────────

function TeachersSection({ deleted, filters }: { deleted: boolean; filters: TeacherFilters }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [
    filters.search, filters.branch, filters.language, filters.subject, filters.age,
  ]);
  const { data, count, loading } = useTeachers(deleted, filters, offset);
  return (
    <>
      <TeacherTable teachers={data} loading={loading} />
      <Pagination count={count} offset={offset} onOffsetChange={setOffset} />
    </>
  );
}

function EmployeesSection({ deleted, branch }: { deleted: boolean; branch: string }) {
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [branch, deleted]);
  const { data, count, loading } = useEmployees(deleted, branch, offset);
  return (
    <>
      <EmployeeTable employees={data} loading={loading} />
      <Pagination count={count} offset={offset} onOffsetChange={setOffset} />
    </>
  );
}

function SalaryTypeCard({ item }: { item: SalaryType }) {
  return (
    <div className="border rounded-lg px-4 py-3 bg-card text-sm min-w-[160px]">
      <p className="text-muted-foreground">Nomi : <span className="text-foreground font-medium">{item.name}</span></p>
      <p className="text-muted-foreground mt-1">Oyligi : <span className="text-foreground font-medium">{item.salary.toLocaleString()}</span></p>
    </div>
  );
}

function SalaryTypesSection({ branches }: { branches: { id: number; name: string }[] }) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const { data, loading } = useSalaryTypes(selectedBranch);

  // Group by branch when no filter selected
  const grouped = selectedBranch
    ? null
    : data.reduce<Record<string, { branchName: string; items: SalaryType[] }>>((acc, item) => {
        const key = item.branch ? String(item.branch.id) : "__unknown__";
        const branchName = item.branch?.name ?? "Noma'lum";
        if (!acc[key]) acc[key] = { branchName, items: [] };
        acc[key].items.push(item);
        return acc;
      }, {});

  return (
    <div>
      <div className="mb-4">
        <Select value={selectedBranch || "__all__"} onValueChange={(v) => setSelectedBranch(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Barcha filiallar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Barcha filiallar</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data.length ? (
        <p className="text-center text-sm text-muted-foreground py-12">Toifalar topilmadi</p>
      ) : grouped ? (
        <div className="overflow-y-auto max-h-[calc(100vh-210px)] space-y-5 pr-1">
          {Object.values(grouped).map(({ branchName, items }) => (
            <div key={branchName}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{branchName}</p>
              <div className="flex flex-wrap gap-3">
                {items.map((item) => <SalaryTypeCard key={item.id} item={item} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100vh-210px)] flex flex-wrap gap-3 pr-1">
          {data.map((item) => <SalaryTypeCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Section = "teachers" | "employees" | "salary-types";

export default function SchoolTeachersPage() {
  const branches = useBranches();
  const languages = useLanguages();
  const subjects = useSubjects();

  const [section, setSection] = useState<Section>("teachers");
  const [teacherDeleted, setTeacherDeleted] = useState(false);
  const [employeeDeleted, setEmployeeDeleted] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [language, setLanguage] = useState("");
  const [subject, setSubject] = useState("");
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

  const filters: TeacherFilters = {
    search: debouncedSearch,
    branch,
    language,
    subject,
    age: debouncedAge,
  };

  const hasFilters = !!(search || branch || language || subject || age);

  return (
    <DashboardLayout title="O'qituvchilar">
      {/* Top: section buttons */}
      <div className="flex items-center gap-1 mb-3">
        <Button variant={section === "teachers" ? "default" : "ghost"} size="sm" onClick={() => setSection("teachers")}>
          O'qituvchilar
        </Button>
        <Button variant={section === "employees" ? "default" : "ghost"} size="sm" onClick={() => setSection("employees")}>
          Ishchilar
        </Button>
        <Button variant={section === "salary-types" ? "default" : "ghost"} size="sm" onClick={() => setSection("salary-types")}>
          Toifa
        </Button>
      </div>

      {/* Teachers section */}
      {section === "teachers" && (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={branch || "__all__"} onValueChange={(v) => setBranch(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Barcha filiallar</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={language || "__all__"} onValueChange={(v) => setLanguage(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Til" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Barcha tillar</SelectItem>
                {languages.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subject || "__all__"} onValueChange={(v) => setSubject(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Fan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Barcha fanlar</SelectItem>
                {subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Yosh" value={age} onChange={(e) => setAge(e.target.value)} className="w-[90px]" min={0} />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setBranch(""); setLanguage(""); setSubject(""); setAge(""); }}>
                Tozalash
              </Button>
            )}
            <Button
              variant={teacherDeleted ? "destructive" : "outline"}
              size="sm"
              className="ml-auto"
              onClick={() => setTeacherDeleted((v) => !v)}
            >
              {teacherDeleted ? "O'chirilgan" : "Faol"}
            </Button>
          </div>
          <TeachersSection deleted={teacherDeleted} filters={filters} />
        </>
      )}

      {/* Employees section */}
      {section === "employees" && (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <Select value={branch || "__all__"} onValueChange={(v) => setBranch(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Filial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Barcha filiallar</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant={employeeDeleted ? "destructive" : "outline"}
              size="sm"
              className="ml-auto"
              onClick={() => setEmployeeDeleted((v) => !v)}
            >
              {employeeDeleted ? "O'chirilgan" : "Faol"}
            </Button>
          </div>
          <EmployeesSection deleted={employeeDeleted} branch={branch} />
        </>
      )}

      {/* Salary types section */}
      {section === "salary-types" && <SalaryTypesSection branches={branches} />}
    </DashboardLayout>
  );
}
