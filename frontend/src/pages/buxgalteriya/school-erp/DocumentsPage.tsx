import { DocumentsContent, SchoolErpPageShell } from "./shared";

export default function SchoolErpDocumentsPage() {
  return (
    <SchoolErpPageShell section="documents">
      {() => <DocumentsContent />}
    </SchoolErpPageShell>
  );
}
