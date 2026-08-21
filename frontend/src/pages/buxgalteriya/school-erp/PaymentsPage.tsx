import { PaymentsContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpPaymentsPage() {
  return (
    <SchoolErpPageShell section="payments" showCreateButton={false}>
      {(openModal, scope) => <PaymentsContent openModal={openModal} scope={scope} />}
    </SchoolErpPageShell>
  );
}
