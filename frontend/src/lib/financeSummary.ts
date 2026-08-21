export interface FinancePaymentTypeTotal {
  payment_type: string | null;
  total: number;
}

export interface FinanceSummarySection {
  total: number;
  by_payment_type: FinancePaymentTypeTotal[];
}

export interface BranchTransactionTotals {
  give: FinanceSummarySection;
  receive: FinanceSummarySection;
  net: number;
}

export interface FinanceOverheadsSummary {
  total: number;
  by_item?: Array<{ item: string | null; total: number }>;
  by_overhead_type?: Array<{ type: string | null; total: number }>;
  by_payment_type: FinancePaymentTypeTotal[];
}

export interface FinanceSummary {
  payments: FinanceSummarySection;
  teacher_salaries: FinanceSummarySection;
  staff_salaries: FinanceSummarySection;
  overheads: FinanceOverheadsSummary;
  capitals?: FinanceSummarySection;
  branch_transactions?: BranchTransactionTotals;
  dividends: number;
  investments?: number;
  total_expenses: number;
  remaining: number;
}
