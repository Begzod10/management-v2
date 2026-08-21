import { DashboardContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpDashboardPage() {
  return (
    <SchoolErpPageShell section="dashboard" showCreateButton={false}>
      {(openModal, scope) => <DashboardContent openModal={openModal} scope={scope} />}
    </SchoolErpPageShell>
  );
}
