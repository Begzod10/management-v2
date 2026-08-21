import { DocumentsContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpAccountingPage() {
  return (
    <SchoolErpPageShell section="accounting">
      {() => <DocumentsContent accounting />}
    </SchoolErpPageShell>
  );
}
