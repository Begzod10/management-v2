import { SchoolErpPageShell, StudentsContent } from "./shared";

export default function SchoolErpStudentsPage() {
  return (
    <SchoolErpPageShell section="students" actionType="student" showCreateButton={false}>
      {(openModal, scope) => <StudentsContent openModal={openModal} scope={scope} />}
    </SchoolErpPageShell>
  );
}
