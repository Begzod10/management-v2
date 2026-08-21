import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { InstitutionProvider } from "@/contexts/InstitutionContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AccountantOnlyGuard, AuthGuard, PageGuard } from "@/components/AuthGuard";
import Index from "./pages/Index";
import StaffPage from "./pages/Staff";
import TasksPage from "./pages/Tasks";
import TaskProfilePage from "./pages/TaskProfile";
import LoginPage from "./pages/Login";
import SettingsPage from "./pages/Settings";
import ProfilePage from "./pages/Profile";
import UserProfilePage from "./pages/UserProfile";
import AccountingPage from "./pages/Accounting";
import FinancePage from "./pages/Finance";
import DashboardBranchProfilePage from "./pages/DashboardBranchProfile";
import DebtorsPage from "./pages/finance/DebtorsPage";
import SalariesPage from "./pages/finance/SalariesPage";
import OverheadsPage from "./pages/finance/OverheadsPage";
import OverheadTypesPage from "./pages/finance/OverheadTypesPage";
import BranchLoansPage from "./pages/finance/BranchLoansPage";
import BranchLoanDetailPage from "./pages/finance/BranchLoanDetailPage";
import SchoolErpDashboardPage from "./pages/buxgalteriya/school-erp/DashboardPage";
import SchoolErpStudentsPage from "./pages/buxgalteriya/school-erp/StudentsPage";
import SchoolErpPaymentsPage from "./pages/buxgalteriya/school-erp/PaymentsPage";
import SchoolErpExpensesPage from "./pages/buxgalteriya/school-erp/ExpensesPage";
import SchoolErpPayrollPage from "./pages/buxgalteriya/school-erp/PayrollPage";
import SchoolErpDebtsPage from "./pages/buxgalteriya/school-erp/DebtsPage";
import SchoolErpCashBankPage from "./pages/buxgalteriya/school-erp/CashBankPage";
import SchoolErpInventoryPage from "./pages/buxgalteriya/school-erp/InventoryPage";
import SchoolErpDocumentsPage from "./pages/buxgalteriya/school-erp/DocumentsPage";
import SchoolErpAccountingPage from "./pages/buxgalteriya/school-erp/AccountingPage";
import SchoolErpReportsPage from "./pages/buxgalteriya/school-erp/ReportsPage";
import SchoolErpBranchesPage from "./pages/buxgalteriya/school-erp/BranchesPage";
import SchoolErpSettingsPage from "./pages/buxgalteriya/school-erp/SettingsPage";
import ProjectsPage from "./pages/Projects";
import ProjectProfilePage from "./pages/ProjectProfile";
import SectionsPage from "./pages/Sections";
import SectionProfilePage from "./pages/SectionProfile";
import SchoolCalendarPage from "./pages/SchoolCalendar";
import SchoolStudentsPage from "./pages/SchoolStudents";
import SchoolTeachersPage from "./pages/SchoolTeachers";
import SchoolGroupsPage from "./pages/SchoolGroups";
import SchoolTimeTablePage from "./pages/SchoolTimeTable";
import SchoolStudentProfilePage from "./pages/SchoolStudentProfile";
import SchoolTeacherProfilePage from "./pages/SchoolTeacherProfile";
import SchoolGroupProfilePage from "./pages/SchoolGroupProfile";
import SchoolFlowProfilePage from "./pages/SchoolFlowProfile";
import SchoolEmployeeProfilePage from "./pages/SchoolEmployeeProfile";
import StatisticsPage from "./pages/Statistics";
import ApplicationSystemPage from "./pages/ApplicationSystemPage";
import NotFound from "./pages/NotFound";
import { VoiceProvider } from "@/contexts/VoiceContext";

const queryClient = new QueryClient();

const getSidebarDefault = () => {
  const cookie = document.cookie.split("; ").find((r) => r.startsWith("sidebar:state="));
  if (cookie) return cookie.split("=")[1] === "true";
  return window.innerWidth >= 1024;
};

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <AuthGuard>
    <VoiceProvider>
      <SidebarProvider defaultOpen={getSidebarDefault()}>
        {children}
      </SidebarProvider>
    </VoiceProvider>
  </AuthGuard>
);

const App = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <InstitutionProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedLayout><PageGuard page="accounting"><Index /></PageGuard></ProtectedLayout>} />
                <Route path="/dashboard/branches/:branchId" element={<ProtectedLayout><PageGuard page="accounting"><DashboardBranchProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/staff" element={<ProtectedLayout><PageGuard page="staff"><StaffPage /></PageGuard></ProtectedLayout>} />
                <Route path="/tasks" element={<ProtectedLayout><PageGuard page="tasks"><TasksPage /></PageGuard></ProtectedLayout>} />
                <Route path="/tasks/:id" element={<ProtectedLayout><PageGuard page="tasks"><TaskProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/settings" element={<ProtectedLayout><PageGuard page="settings"><SettingsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/profile" element={<ProtectedLayout><ProfilePage /></ProtectedLayout>} />
                <Route path="/staff/:id" element={<ProtectedLayout><PageGuard page="user_profile"><UserProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/accounting" element={<ProtectedLayout><PageGuard page="accounting"><AccountingPage /></PageGuard></ProtectedLayout>} />
                <Route path="/finance" element={<ProtectedLayout><PageGuard page="accounting"><FinancePage /></PageGuard></ProtectedLayout>} />
                <Route path="/finance/debtors" element={<ProtectedLayout><PageGuard page="accounting"><DebtorsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/finance/salaries" element={<ProtectedLayout><PageGuard page="accounting"><SalariesPage /></PageGuard></ProtectedLayout>} />
                <Route path="/finance/overheads" element={<ProtectedLayout><PageGuard page="accounting"><OverheadsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/branch-loans" element={<ProtectedLayout><PageGuard page="accounting"><BranchLoansPage /></PageGuard></ProtectedLayout>} />
                <Route path="/finance/transactions/:id" element={<ProtectedLayout><PageGuard page="accounting"><BranchLoanDetailPage /></PageGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/overhead-types" element={<ProtectedLayout><PageGuard page="accounting"><OverheadTypesPage /></PageGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/dashboard" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpDashboardPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/students" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpStudentsPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/payments" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpPaymentsPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/expenses" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpExpensesPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/payroll" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpPayrollPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/debts" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpDebtsPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/cashbank" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpCashBankPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/inventory" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpInventoryPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/documents" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpDocumentsPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/accounting" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpAccountingPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/reports" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpReportsPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/branches" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpBranchesPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/buxgalteriya/settings" element={<ProtectedLayout><AccountantOnlyGuard><SchoolErpSettingsPage /></AccountantOnlyGuard></ProtectedLayout>} />
                <Route path="/projects" element={<ProtectedLayout><PageGuard page="projects"><ProjectsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/projects/:id" element={<ProtectedLayout><PageGuard page="projects"><ProjectProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/sections" element={<ProtectedLayout><PageGuard page="sections"><SectionsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/sections/:id" element={<ProtectedLayout><PageGuard page="sections"><SectionProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/calendar" element={<ProtectedLayout><PageGuard page="school_calendar"><SchoolCalendarPage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/students" element={<ProtectedLayout><PageGuard page="school_students"><SchoolStudentsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/students/:id" element={<ProtectedLayout><PageGuard page="school_students"><SchoolStudentProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/teachers" element={<ProtectedLayout><PageGuard page="school_teachers"><SchoolTeachersPage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/teachers/:id" element={<ProtectedLayout><PageGuard page="school_teachers"><SchoolTeacherProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/groups" element={<ProtectedLayout><PageGuard page="school_groups"><SchoolGroupsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/groups/:id" element={<ProtectedLayout><PageGuard page="school_groups"><SchoolGroupProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/flows/:id" element={<ProtectedLayout><PageGuard page="school_groups"><SchoolFlowProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/employees/:id" element={<ProtectedLayout><PageGuard page="school_teachers"><SchoolEmployeeProfilePage /></PageGuard></ProtectedLayout>} />
                <Route path="/school/timetable" element={<ProtectedLayout><PageGuard page="school_timetable"><SchoolTimeTablePage /></PageGuard></ProtectedLayout>} />
                <Route path="/statistics" element={<ProtectedLayout><PageGuard page="statistics"><StatisticsPage /></PageGuard></ProtectedLayout>} />
                <Route path="/applications" element={<ProtectedLayout><PageGuard page="applications"><ApplicationSystemPage /></PageGuard></ProtectedLayout>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </InstitutionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GoogleOAuthProvider>
);

export default App;
