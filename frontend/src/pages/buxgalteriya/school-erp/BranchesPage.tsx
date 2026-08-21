import { BranchesContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpBranchesPage() {
  return (
    <SchoolErpPageShell section="branches">
      {() => <BranchesContent />}
    </SchoolErpPageShell>
  );
}
