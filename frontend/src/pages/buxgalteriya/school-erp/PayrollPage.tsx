import { GenericContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpPayrollPage() {
  return (
    <SchoolErpPageShell section="payroll" showCreateButton={false}>
      {(_, scope) => <GenericContent section="payroll" scope={scope} />}
    </SchoolErpPageShell>
  );
}
