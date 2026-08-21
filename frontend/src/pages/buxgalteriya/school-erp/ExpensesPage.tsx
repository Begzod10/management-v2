import { GenericContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpExpensesPage() {
  return (
    <SchoolErpPageShell section="expenses" actionType="expense" showCreateButton={false}>
      {(_, scope) => <GenericContent section="expenses" scope={scope} />}
    </SchoolErpPageShell>
  );
}
