import { ReportsContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpReportsPage() {
  return (
    <SchoolErpPageShell section="reports" actionType="report">
      {(openModal) => <ReportsContent openModal={openModal} />}
    </SchoolErpPageShell>
  );
}
