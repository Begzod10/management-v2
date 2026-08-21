import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

interface ApiUsage {
  method: string;
  path: string;
  total_requests: number;
  percentage: number;
  avg_response_ms: number;
}

const getColorByMethod = (method: string): string => {
  const colors: Record<string, string> = {
    GET: "#3b82f6",
    POST: "#10b981",
    PUT: "#f59e0b",
    DELETE: "#ef4444",
    PATCH: "#8b5cf6",
    HEAD: "#06b6d4",
    OPTIONS: "#6b7280",
  };
  return colors[method] || "#6b7280";
};

const chartConfig = {
  total_requests: { label: "Total Requests", color: "#3b82f6" },
};

export const ApiUsageChart = ({ data }: { data: ApiUsage[] }) => {
  const chartData = data
    .map((item) => ({ ...item, label: `${item.method} ${item.path}` }))
    .sort((a, b) => b.total_requests - a.total_requests);

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" angle={-45} textAnchor="end" height={120} interval={0} tick={{ fontSize: 11 }} />
          <YAxis label={{ value: "Requests", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: "8px" }}
            formatter={(value: number, _name: string, props) => {
              const pct = (props.payload as { percentage?: number })?.percentage;
              return [`${value}${pct != null ? ` (${pct.toFixed(1)}%)` : ""}`, "Requests"];
            }}
          />
          <Legend />
          <Bar dataKey="total_requests" name="Total Requests" radius={[6, 6, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColorByMethod(entry.method)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
