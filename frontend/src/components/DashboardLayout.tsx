import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { VoiceWidget } from "@/components/VoiceWidget";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  headerExtra?: React.ReactNode;
}

export function DashboardLayout({ children, title, headerExtra }: DashboardLayoutProps) {
  return (
    <div className="h-screen flex w-full bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader title={title} extra={headerExtra} />
        <main className="flex-1 p-3 sm:p-6 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
      <VoiceWidget />
    </div>
  );
}
