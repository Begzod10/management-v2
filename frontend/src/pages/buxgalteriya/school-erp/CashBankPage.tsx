import { GenericContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpCashBankPage() {
  return (
    <SchoolErpPageShell section="cashbank" actionType="txn">
      {() => <GenericContent section="cashbank" />}
    </SchoolErpPageShell>
  );
}
