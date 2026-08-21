import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/ui/chart";

interface SectionUsage {
  section: string;
  total_requests: number;
  percentage: number;
  avg_response_ms: number;
}

const chartConfig = {
  percentage: { label: "Foiz (%)", color: "#8b5cf6" },
};

export const SectionUsageChart = ({ data }: { data: SectionUsage[] }) => {
  const chartData = [...data].sort((a, b) => b.percentage - a.percentage);

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="section" angle={-45} textAnchor="end" height={100} interval={0} tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", border: "none", borderRadius: "8px" }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Foiz"]}
          />
          <Legend />
          <Bar dataKey="percentage" fill="#8b5cf6" name="Foiz (%)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
