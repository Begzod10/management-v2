import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessPage, hasPermission, roleRank } from "@/lib/permissions";
import { useInstitution } from "@/contexts/InstitutionContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  Wallet,
  BarChart3,
  FolderKanban,
  LayoutList,
  CalendarDays,
  GraduationCap,
  BookOpen,
  UsersRound,
  Clock,
  TrendingUp,
  BookMarked,
  ChevronRight,
  Inbox,
  HandCoins,
  CreditCard,
  ReceiptText,
  Landmark,
  Package,
  FileText,
  Calculator,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SIDEBAR_SCROLL_KEY = "app-sidebar-scroll-top";

const regularSections = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, page: "dashboard" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Xodimlar", url: "/staff", icon: Users, page: "staff" },
      { title: "Vazifalar", url: "/tasks", icon: ClipboardList, page: "tasks" },
      { title: "Loyihalar", url: "/projects", icon: FolderKanban, page: "projects" },
      { title: "Bo'limlar", url: "/sections", icon: LayoutList, page: "sections" },
      { title: "Moliya Boshqarma", url: "/finance", icon: BarChart3, page: "accounting" },
      { title: "Statistika", url: "/statistics", icon: TrendingUp, page: "statistics" },
      { title: "Talablar Tizimi", url: "/applications", icon: Inbox, page: "applications" },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Settings", url: "/settings", icon: Settings, page: "settings" },
    ],
  },
];

const accordionSections = [
  {
    label: "Buxgalter",
    page: null as string | null,
    items: [
      { title: "Moliya", url: "/accounting", icon: Wallet, page: "accounting" },
      { title: "Xarajat Turlari", url: "/buxgalteriya/overhead-types", icon: BookMarked, page: "accounting" },
      { title: "Tranzaksiyalar", url: "/buxgalteriya/branch-loans", icon: HandCoins, page: "accounting" },
      { title: "Dashboard", url: "/buxgalteriya/dashboard", icon: LayoutDashboard, page: "accounting", accountantOnly: true, group: "Asosiy" },
      { title: "O'quvchilar", url: "/buxgalteriya/students", icon: GraduationCap, page: "accounting", accountantOnly: true, group: "Asosiy" },
      { title: "To'lovlar", url: "/buxgalteriya/payments", icon: CreditCard, page: "accounting", accountantOnly: true, group: "Asosiy" },
      { title: "Xarajatlar", url: "/buxgalteriya/expenses", icon: ReceiptText, page: "accounting", accountantOnly: true, group: "Moliya" },
      { title: "Ish haqi", url: "/buxgalteriya/payroll", icon: Wallet, page: "accounting", accountantOnly: true, group: "Moliya" },
      { title: "Qarzlar", url: "/buxgalteriya/debts", icon: BookOpen, page: "accounting", accountantOnly: true, group: "Moliya" },
      { title: "Kassa & Bank", url: "/buxgalteriya/cashbank", icon: Landmark, page: "accounting", accountantOnly: true, group: "Moliya" },
      { title: "Inventar", url: "/buxgalteriya/inventory", icon: Package, page: "accounting", accountantOnly: true, group: "Operatsiyalar" },
      { title: "Hujjatlar", url: "/buxgalteriya/documents", icon: FileText, page: "accounting", accountantOnly: true, group: "Operatsiyalar" },
      { title: "Buxgalteriya", url: "/buxgalteriya/accounting", icon: Calculator, page: "accounting", accountantOnly: true, group: "Operatsiyalar" },
      { title: "Hisobotlar", url: "/buxgalteriya/reports", icon: ReceiptText, page: "accounting", accountantOnly: true, group: "Operatsiyalar" },
      { title: "Filiallar", url: "/buxgalteriya/branches", icon: Building2, page: "accounting", accountantOnly: true, group: "Tizim" },
      { title: "Sozlamalar", url: "/buxgalteriya/settings", icon: Settings, page: "accounting", accountantOnly: true, group: "Tizim" },
    ],
  },
  {
    label: "Spiritualist",
    page: "school_access" as string | null,
    items: [
      { title: "Kalendar",      url: "/school/calendar",  icon: CalendarDays,  page: "school_calendar"  },
      { title: "O'quvchilar",   url: "/school/students",  icon: GraduationCap, page: "school_students"  },
      { title: "O'qituvchilar", url: "/school/teachers",  icon: BookOpen,      page: "school_teachers"  },
      { title: "Sinflar",       url: "/school/groups",    icon: UsersRound,    page: "school_groups"    },
      { title: "Dars jadvali",  url: "/school/timetable", icon: Clock,         page: "school_timetable" },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { systemModels, selectedModelId: selectedId, setSelectedModelId: setSelectedId } = useInstitution();

  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

  const selectedModel = systemModels.find((m) => String(m.id) === selectedId);

  const toggleAccordion = (label: string) =>
    setOpenAccordions((prev) => ({ ...prev, [label]: !prev[label] }));

  useEffect(() => {
    if (collapsed) return;
    const savedScrollTop = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? 0);
    const frame = requestAnimationFrame(() => {
      if (contentRef.current) contentRef.current.scrollTop = savedScrollTop;
    });
    return () => cancelAnimationFrame(frame);
  }, [collapsed, location.pathname]);

  return (
    <Sidebar collapsible="icon">
      {(roleRank(user?.role) >= 6 || hasPermission(user?.role, "accounting")) && (
        <SidebarHeader className="h-[56px] flex items-center justify-center border-b border-sidebar-border overflow-hidden">
          {!collapsed ? (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full h-9 text-sm font-medium">
                <SelectValue placeholder="Tizimni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {systemModels.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex justify-center w-full">
              <button
                onClick={() => {
                  if (systemModels.length < 2) return;
                  const idx = systemModels.findIndex((m) => String(m.id) === selectedId);
                  setSelectedId(String(systemModels[(idx + 1) % systemModels.length].id));
                }}
                title={selectedModel?.name}
                className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                {selectedModel?.name?.charAt(0).toUpperCase() ?? "?"}
              </button>
            </div>
          )}
        </SidebarHeader>
      )}

      <SidebarContent
        ref={contentRef}
        className="pt-2"
        onScroll={(event) => {
          sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(event.currentTarget.scrollTop));
        }}
      >
        {/* Regular flat sections */}
        {regularSections.map((section) => {
          const visibleItems = section.items.filter((item) =>
            canAccessPage(user?.role, item.page)
          );
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={section.label} className="px-2">
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                          activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Accordion sections */}
        {accordionSections.map((section) => {
          const visibleItems = section.items.filter((item) =>
            canAccessPage(user?.role, item.page) &&
            (!("accountantOnly" in item) || item.accountantOnly !== true || user?.role === "accountant" || user?.role === "owner" || user?.role === "admin")
          );
          const sectionVisible = section.page
            ? canAccessPage(user?.role, section.page)
            : visibleItems.length > 0;
          if (!sectionVisible || visibleItems.length === 0) return null;

          const hasActiveItem = visibleItems.some((item) =>
            item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url)
          );
          const isOpen = hasActiveItem || !!openAccordions[section.label];
          const ungroupedItems = visibleItems.filter((item) => !("group" in item));
          const groupedItems = ["Asosiy", "Moliya", "Operatsiyalar", "Tizim"]
            .map((group) => ({
              group,
              items: visibleItems.filter((item) => "group" in item && item.group === group),
            }))
            .filter((group) => group.items.length > 0);

          if (collapsed) {
            return (
              <SidebarGroup key={section.label} className="px-2">
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {visibleItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild tooltip={item.title}>
                          <NavLink
                            to={item.url}
                            end={false}
                            className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                            activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={section.label} className="px-2">
              <Collapsible open={isOpen} onOpenChange={() => toggleAccordion(section.label)}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-1 px-2 mb-1 group">
                    <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors">
                      {section.label}
                    </span>
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-all duration-200",
                        isOpen && "rotate-90"
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  <div className="mt-0.5 ml-2 border-l border-sidebar-border/50 pl-2">
                    <SidebarMenu className="gap-0.5">
                      {ungroupedItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end={false}
                              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                              activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                            >
                              <item.icon className="h-3.5 w-3.5 shrink-0" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                      {groupedItems.map((group) => (
                        <div key={group.group} className="pt-3 first:pt-1">
                          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                            {group.group}
                          </div>
                          {group.items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <NavLink
                                  to={item.url}
                                  end={false}
                                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                                  activeClassName="bg-sidebar-accent text-sidebar-foreground font-medium"
                                >
                                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                                  <span>{item.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </div>
                      ))}
                    </SidebarMenu>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
