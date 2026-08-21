import { SchoolErpPageShell, SettingsContent } from "./shared";

export default function SchoolErpSettingsPage() {
  return (
    <SchoolErpPageShell section="settings">
      {() => <SettingsContent />}
    </SchoolErpPageShell>
  );
}
