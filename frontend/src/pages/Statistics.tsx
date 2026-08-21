import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { UserUsageChart } from "@/components/statistics/UserUsageChart";
import { SectionUsageChart } from "@/components/statistics/SectionUsageChart";
import { AlertCircle, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface UserUsage {
  user_id: number;
  name: string;
  surname: string;
  total_requests: number;
  percentage: number;
}

interface SectionUsage {
  section: string;
  total_requests: number;
  percentage: number;
  avg_response_ms: number;
}

type System = "boshqaruv" | "gennis" | "turon";

const API_PATHS: Record<System, { byUser: string; bySection: string }> = {
  boshqaruv: {
    byUser: "/statistics/api-usage/by-user",
    bySection: "/statistics/api-usage/by-section",
  },
  gennis: {
    byUser: "/statistics/gennis/api-usage/by-user",
    bySection: "/statistics/gennis/api-usage/by-section",
  },
  turon: {
    byUser: "/statistics/turon/api-usage/by-user",
    bySection: "/statistics/turon/api-usage/by-section",
  },
};

function useStatData<T>(url: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Xatolik yuz berdi"))))
      .then((d: T[]) => setData(Array.isArray(d) ? d : []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Xatolik yuz berdi"))
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error };
}

function ChartCard({
  title,
  description,
  loading,
  error,
  hasData,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="shrink-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        ) : hasData ? (
          <div className="h-96">{children}</div>
        ) : (
          <div className="flex justify-center py-6 text-sm text-muted-foreground">
            Ma'lumot mavjud emas
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Statistics = () => {
  const [system, setSystem] = useState<System>("boshqaruv");
  const [fromDate, setFromDate] = useState<Date>(new Date());
  const [toDate, setToDate] = useState<Date>(new Date());

  const dateParams = `from_date=${format(fromDate, "yyyy-MM-dd")}&to_date=${format(toDate, "yyyy-MM-dd")}&limit=50`;
  const paths = API_PATHS[system];

  const userUsage = useStatData<UserUsage>(`${paths.byUser}?${dateParams}`);
  const sectionUsage = useStatData<SectionUsage>(`${paths.bySection}?${dateParams}`);

  const filters = (
    <div className="flex items-center gap-2">
      <Select value={system} onValueChange={(v) => setSystem(v as System)}>
        <SelectTrigger className="h-8 w-36 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="boshqaruv">Boshqaruv</SelectItem>
          <SelectItem value="gennis">Gennis</SelectItem>
          <SelectItem value="turon">Turon</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-8 px-3 text-sm font-normal gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(fromDate, "dd.MM.yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={fromDate}
            onSelect={(d) => d && setFromDate(d)}
            disabled={(d) => d > toDate}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground text-sm">—</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-8 px-3 text-sm font-normal gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(toDate, "dd.MM.yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={toDate}
            onSelect={(d) => d && setToDate(d)}
            disabled={(d) => d < fromDate || d > new Date()}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DashboardLayout title="Statistika" headerExtra={filters}>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pb-1">
        <ChartCard
          title="Bo'limlar Bo'yicha"
          description="Xususiyat bo'limlari bo'yicha so'rovlar soni"
          loading={sectionUsage.loading}
          error={sectionUsage.error}
          hasData={sectionUsage.data.length > 0}
        >
          <SectionUsageChart data={sectionUsage.data} />
        </ChartCard>

        <ChartCard
          title="Foydalanuvchilar Faolligi"
          description="Foydalanuvchilar bo'yicha so'rovlar soni"
          loading={userUsage.loading}
          error={userUsage.error}
          hasData={userUsage.data.length > 0}
        >
          <UserUsageChart data={userUsage.data} />
        </ChartCard>
      </div>
    </DashboardLayout>
  );
};

export default Statistics;
