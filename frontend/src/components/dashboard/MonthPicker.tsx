import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

export type MonthPickerMode = "month" | "range";

interface MonthPickerProps {
  from: string;
  to: string;
  mode?: MonthPickerMode;
  onModeChange?: (mode: MonthPickerMode) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onRangeChange?: (from: string, to: string) => void;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange(year: number, month: number) {
  return {
    from: formatDateInput(new Date(year, month, 1)),
    to: formatDateInput(new Date(year, month + 1, 0)),
  };
}

function parseDateValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    month: Number.isFinite(month) ? month - 1 : new Date().getMonth(),
  };
}

export function MonthPicker({ from, to, mode: controlledMode, onModeChange, onFromChange, onToChange, onRangeChange }: MonthPickerProps) {
  const [uncontrolledMode, setUncontrolledMode] = useState<MonthPickerMode>("month");
  const mode = controlledMode ?? uncontrolledMode;
  const selectedDate = parseDateValue(from);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
  }, []);

  const applyMonthRange = (year: number, month: number) => {
    const range = monthRange(year, month);
    if (onRangeChange) {
      onRangeChange(range.from, range.to);
      return;
    }
    onFromChange(range.from);
    onToChange(range.to);
  };

  const handleModeChange = (value: MonthPickerMode) => {
    if (controlledMode === undefined) setUncontrolledMode(value);
    onModeChange?.(value);
    if (value === "month") {
      applyMonthRange(selectedDate.year, selectedDate.month);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={mode} onValueChange={(value) => handleModeChange(value as "month" | "range")}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Oy</SelectItem>
          <SelectItem value="range">Oraliq</SelectItem>
        </SelectContent>
      </Select>

      {mode === "month" ? (
        <>
          <Select
            value={String(selectedDate.month)}
            onValueChange={(value) => applyMonthRange(selectedDate.year, Number(value))}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, index) => (
                <SelectItem key={name} value={String(index)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedDate.year)}
            onValueChange={(value) => applyMonthRange(Number(value), selectedDate.month)}
          >
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-10 shrink-0 sm:w-auto">Dan</span>
            <input
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              className="h-8 w-[130px] rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground">—</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-10 shrink-0 sm:w-auto">Gacha</span>
            <input
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              className="h-8 w-[130px] rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
      )}
    </div>
  );
}
