import { DebtsContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpDebtsPage() {
  return (
    <SchoolErpPageShell section="debts" actionType="debt" showCreateButton={false}>
      {(_, scope) => <DebtsContent scope={scope} />}
    </SchoolErpPageShell>
  );
}
