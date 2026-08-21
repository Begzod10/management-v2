import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

interface UserPerfEntry {
  user_id: number;
  name: string;
  surname: string;
  role: string;
  total: number;
  finished: number;
  not_finished: number;
  approved: number;
  rejected: number;
  finished_percentage: number;
  not_finished_percentage: number;
  approved_percentage_of_total: number;
  approved_percentage_of_finished: number;
  rejected_percentage: number;
  on_time: number;
  late: number;
  on_time_percentage_of_finished: number;
  late_percentage_of_finished: number;
  on_time_percentage_of_total: number;
  late_percentage_of_total: number;
  approved_on_time: number;
  approved_late: number;
  approved_on_time_percentage_of_approved: number;
  approved_late_percentage_of_approved: number;
  subtasks?: SubtaskPerf;
}

interface SubtaskPerf {
  total: number;
  done: number;
  pending: number;
  approved: number;
  done_percentage: number;
  pending_percentage: number;
  on_time: number;
  late: number;
  on_time_percentage_of_done: number;
  late_percentage_of_done: number;
}

interface OverallPerf extends Omit<UserPerfEntry, "user_id" | "name" | "surname" | "role"> {
  subtasks?: SubtaskPerf;
}

interface UserPerfResponse {
  from_date: string;
  to_date: string;
  user_id: number | null;
  users: UserPerfEntry[];
  overall: OverallPerf;
}

interface ManagerStat {
  id: number;
  name: string;
  role: string;
  manager_type: string[];
  created: number;
  reviewed: number;
  received: number;
  rejected: number;
  created_share_pct: number;
  reviewed_share_pct: number;
  received_share_pct: number;
  rejected_share_pct: number;
  rejection_rate_pct: number;
  subtasks_created?: number;
  subtasks_received?: number;
  subtasks_done?: number;
  subtasks_created_share_pct?: number;
  subtasks_received_share_pct?: number;
  subtasks_done_rate_pct?: number;
}

interface ManagersResponse {
  from_date: string;
  to_date: string;
  totals: {
    created: number;
    reviewed: number;
    received: number;
    rejected: number;
    subtasks_created?: number;
    subtasks_received?: number;
    subtasks_done?: number;
  };
  managers: ManagerStat[];
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function pct(v: number | undefined | null): string {
  if (v == null) return "0%";
  return `${v % 1 === 0 ? v : v.toFixed(1)}%`;
}

function managerTypeLabel(types: string[]): string {
  const map: Record<string, string> = {
    section_leader: "Bo'lim boshlig'i",
    project_manager: "Loyiha menejeri",
  };
  return types.map((t) => map[t] ?? t).join(", ");
}

export function TaskStatsView() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(todayStr());

  const [perf, setPerf] = useState<UserPerfResponse | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);

  const [managersData, setManagersData] = useState<ManagersResponse | null>(null);
  const [managersLoading, setManagersLoading] = useState(false);

  const loadPerf = useCallback(async () => {
    setPerfLoading(true);
    try {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
      const res = await apiFetch(`/missions/stats/user-performance?${params}`);
      if (res.ok) {
        setPerf(await res.json());
      } else {
        toast.error("Ijrochi statistikasini yuklab bo'lmadi");
      }
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setPerfLoading(false);
    }
  }, [fromDate, toDate]);

  const loadManagers = useCallback(async () => {
    setManagersLoading(true);
    try {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
      const res = await apiFetch(`/missions/stats/managers?${params}`);
      if (res.ok) {
        setManagersData(await res.json());
      } else {
        toast.error("Menejer statistikasini yuklab bo'lmadi");
      }
    } catch {
      toast.error("Serverga ulanib bo'lmadi");
    } finally {
      setManagersLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadPerf();
    loadManagers();
  }, [loadPerf, loadManagers]);

  const handleRefresh = () => {
    loadPerf();
    loadManagers();
  };

  return (
    <div className="space-y-5 flex-1 overflow-auto pb-4">
      {/* Date range */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Boshlanish sanasi</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 w-40 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tugash sanasi</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 w-40 text-sm" />
            </div>
            <Button size="sm" onClick={handleRefresh} disabled={perfLoading || managersLoading}>
              {(perfLoading || managersLoading)
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <RefreshCw className="h-4 w-4 mr-1" />}
              Yangilash
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Ijrochi samaradorligi
          </CardTitle>
        </CardHeader>
        {perfLoading ? (
          <CardContent className="pt-0">
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        ) : !perf ? (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground text-center py-8">Ma'lumot yo'q</p>
          </CardContent>
        ) : (
          <>
            {/* Overall summary cards */}
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <StatCard label="Jami vazifalar" value={perf.overall.total} />
                <StatCard label="Bajarildi" value={perf.overall.finished} color="green" sub={pct(perf.overall.finished_percentage)} />
                <StatCard label="Tasdiqlandi" value={perf.overall.approved} color="blue" sub={pct(perf.overall.approved_percentage_of_total)} />
                <StatCard label="Rad etildi" value={perf.overall.rejected} color="red" sub={pct(perf.overall.rejected_percentage)} />
                <StatCard label="Bajarilmadi" value={perf.overall.not_finished} color="red" sub={pct(perf.overall.not_finished_percentage)} />
                <StatCard label="O'z vaqtida" value={perf.overall.on_time} color="green" sub={pct(perf.overall.on_time_percentage_of_finished)} />
                <StatCard label="Kechikib" value={perf.overall.late} color="red" sub={pct(perf.overall.late_percentage_of_finished)} />
              </div>
              {perf.overall.subtasks && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  <StatCard label="Jami kichik vazifalar" value={perf.overall.subtasks.total} />
                  <StatCard label="Kichik bajarildi" value={perf.overall.subtasks.done} color="green" sub={pct(perf.overall.subtasks.done_percentage)} />
                  <StatCard label="Kichik kutilmoqda" value={perf.overall.subtasks.pending} color="red" sub={pct(perf.overall.subtasks.pending_percentage)} />
                  <StatCard label="Kichik tasdiqlandi" value={perf.overall.subtasks.approved} color="blue" />
                  <StatCard label="Kichik o'z vaqtida" value={perf.overall.subtasks.on_time} color="green" sub={pct(perf.overall.subtasks.on_time_percentage_of_done)} />
                  <StatCard label="Kichik kechikib" value={perf.overall.subtasks.late} color="red" sub={pct(perf.overall.subtasks.late_percentage_of_done)} />
                </div>
              )}
            </CardContent>

            {/* Per-user table */}
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap sticky left-0 z-20 bg-muted">Xodim</TableHead>
                    <TableHead className="text-xs text-muted-foreground whitespace-nowrap">Rol</TableHead>
                    <TableHead className="text-center">Jami</TableHead>
                    <TableHead className="text-center">Bajarildi</TableHead>
                    <TableHead className="text-center">Tasdiqlandi</TableHead>
                    <TableHead className="text-center">Bajarilmadi</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Rad etildi</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Bajarilish %</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Tasdiqlanish %</TableHead>
                    <TableHead className="text-center whitespace-nowrap">O'z vaqtida</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kechikib</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kichik jami</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kichik bajarildi</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kichik o'z vaqtida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perf.users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium whitespace-nowrap sticky left-0 z-10 bg-card">
                        {u.name}{u.surname && u.surname !== u.name ? ` ${u.surname}` : ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{u.role}</TableCell>
                      <TableCell className="text-center font-mono">{u.total}</TableCell>
                      <TableCell className="text-center font-mono text-green-600">{u.finished}</TableCell>
                      <TableCell className="text-center font-mono text-blue-600">{u.approved}</TableCell>
                      <TableCell className="text-center font-mono text-destructive">{u.not_finished}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono text-sm ${u.rejected > 0 ? "text-destructive" : "text-muted-foreground"}`}>{u.rejected}</span>
                        {u.rejected > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(u.rejected_percentage)})</span>}
                      </TableCell>
                      <TableCell className="text-center"><PctBadge v={u.finished_percentage} good /></TableCell>
                      <TableCell className="text-center"><PctBadge v={u.approved_percentage_of_total} good /></TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm text-green-600">{u.on_time}</span>
                        {u.finished > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(u.on_time_percentage_of_finished)})</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono text-sm ${u.late > 0 ? "text-destructive" : "text-muted-foreground"}`}>{u.late}</span>
                        {u.late > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(u.late_percentage_of_finished)})</span>}
                      </TableCell>
                      <TableCell className="text-center font-mono">{u.subtasks?.total ?? 0}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm text-green-600">{u.subtasks?.done ?? 0}</span>
                        {u.subtasks && u.subtasks.total > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(u.subtasks.done_percentage)})</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm text-green-600">{u.subtasks?.on_time ?? 0}</span>
                        {u.subtasks && u.subtasks.done > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(u.subtasks.on_time_percentage_of_done)})</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm font-semibold">Jami</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{perf.overall.total}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-green-600">{perf.overall.finished}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-blue-600">{perf.overall.approved}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-destructive">{perf.overall.not_finished}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-destructive">{perf.overall.rejected}</TableCell>
                    <TableCell className="text-center"><PctBadge v={perf.overall.finished_percentage} good /></TableCell>
                    <TableCell className="text-center"><PctBadge v={perf.overall.approved_percentage_of_total} good /></TableCell>
                    <TableCell className="text-center font-mono font-semibold text-green-600">{perf.overall.on_time}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-destructive">{perf.overall.late}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{perf.overall.subtasks?.total ?? 0}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-green-600">{perf.overall.subtasks?.done ?? 0}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-green-600">{perf.overall.subtasks?.on_time ?? 0}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* Manager stats */}
      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Menejer statistikasi
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            {managersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !managersData ? (
              <p className="text-sm text-muted-foreground text-center py-8">Ma'lumot yo'q</p>
            ) : (
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-muted">Menejer</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Turi</TableHead>
                    <TableHead className="text-center">Yaratildi</TableHead>
                    <TableHead className="text-center">Ko'rib chiqildi</TableHead>
                    <TableHead className="text-center">Qabul qilindi</TableHead>
                    <TableHead className="text-center">Rad etildi</TableHead>
                    <TableHead className="text-center">Rad etish %</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kichik yaratildi</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kichik qabul</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kichik bajarildi</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Kichik bajarilish %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managersData.managers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium whitespace-nowrap sticky left-0 z-10 bg-card">{m.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {managerTypeLabel(m.manager_type)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm">{m.created}</span>
                        {m.created > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(m.created_share_pct)})</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm">{m.reviewed}</span>
                        {m.reviewed > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(m.reviewed_share_pct)})</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm text-green-600">{m.received}</span>
                        {m.received > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(m.received_share_pct)})</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono text-sm ${m.rejected > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {m.rejected}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <PctBadge v={m.rejection_rate_pct} good={false} zeroNeutral />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm">{m.subtasks_created ?? 0}</span>
                        {(m.subtasks_created ?? 0) > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(m.subtasks_created_share_pct)})</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono text-sm">{m.subtasks_received ?? 0}</span>
                        {(m.subtasks_received ?? 0) > 0 && <span className="text-xs text-muted-foreground ml-1">({pct(m.subtasks_received_share_pct)})</span>}
                      </TableCell>
                      <TableCell className="text-center font-mono text-green-600">{m.subtasks_done ?? 0}</TableCell>
                      <TableCell className="text-center">
                        <PctBadge v={m.subtasks_done_rate_pct} good zeroNeutral />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {/* Totals row */}
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm font-semibold">Jami</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{managersData.totals.created}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{managersData.totals.reviewed}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-green-600">{managersData.totals.received}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-destructive">{managersData.totals.rejected}</TableCell>
                    <TableCell />
                    <TableCell className="text-center font-mono font-semibold">{managersData.totals.subtasks_created ?? 0}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{managersData.totals.subtasks_received ?? 0}</TableCell>
                    <TableCell className="text-center font-mono font-semibold text-green-600">{managersData.totals.subtasks_done ?? 0}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number; color?: "green" | "red" | "blue"; sub?: string }) {
  const colorCls = color === "green"
    ? "text-green-600"
    : color === "red"
      ? "text-destructive"
      : color === "blue"
        ? "text-blue-600"
        : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${colorCls}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PctBadge({ v, good, zeroNeutral }: { v: number | undefined | null; good: boolean; zeroNeutral?: boolean }) {
  const val = v ?? 0;
  if (zeroNeutral && val === 0) {
    return <Badge variant="outline" className="font-mono text-xs text-muted-foreground">0%</Badge>;
  }
  const isGood = good ? val >= 70 : val <= 20;
  const isMid = good ? val >= 40 : val <= 50;
  const cls = isGood
    ? "text-green-600 bg-green-500/10 border-green-500/20"
    : isMid
      ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
      : "text-destructive bg-destructive/10 border-destructive/20";
  return <Badge variant="outline" className={`font-mono text-xs ${cls}`}>{pct(val)}</Badge>;
}
