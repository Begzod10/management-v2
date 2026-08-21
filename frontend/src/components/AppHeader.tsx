import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Sun, Moon, SlidersHorizontal } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface AppHeaderProps {
  title: string;
  extra?: React.ReactNode;
}

export function AppHeader({ title, extra }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState(false);

  const userEmail = user?.email ?? "";
  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : "?";

  return (
    <header className="h-14 border-b bg-card/80 backdrop-blur-sm flex items-center gap-3 px-4 shrink-0 sticky top-0 z-10">
      <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
      <div className="w-px h-5 bg-border shrink-0" />
      <h1 className="text-base font-semibold truncate text-foreground">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Desktop: inline filters */}
        {extra && <div className="hidden sm:flex items-center gap-2">{extra}</div>}

        {/* Mobile: filter button opens drawer */}
        {extra && (
          <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Filtrlar</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6 w-full">
                {extra}
              </div>
            </DrawerContent>
          </Drawer>
        )}

        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Qidirish..."
            className="pl-8 w-48 h-8 text-sm bg-muted/50 border-0 focus-visible:bg-background focus-visible:border focus-visible:ring-0"
          />
        </div>

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground">
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/profile")}>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  );
}
