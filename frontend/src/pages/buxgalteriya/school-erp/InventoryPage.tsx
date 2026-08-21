import { GenericContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpInventoryPage() {
  return (
    <SchoolErpPageShell section="inventory">
      {() => <GenericContent section="inventory" />}
    </SchoolErpPageShell>
  );
}
