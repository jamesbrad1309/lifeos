import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Sidebar } from "#components/layout/Sidebar";
import { Button } from "#components/ui/button";
import { useStoredState } from "#hooks/useStoredState";
import { useTheme } from "#hooks/useTheme";
import { NAV_ITEMS, type ViewId } from "#lib/navigation";
import { cn } from "#lib/utils";

interface Props {
  view: ViewId;
  /** Extra controls for the app bar's right side, owned by the open page. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Full-viewport dashboard frame: a sidebar (an icon rail when collapsed on
 * desktop, a slide-in drawer below `lg`), a sticky app bar, and a scrolling
 * content area that pages fill edge to edge.
 */
export function AppShell({ view, actions, children }: Props) {
  const [collapsed, setCollapsed] = useStoredState("lifeos.sidebarCollapsed", false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const item = NAV_ITEMS.find((i) => i.id === view) ?? NAV_ITEMS[0];
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex h-svh overflow-hidden bg-muted/30">
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-background transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Sidebar view={view} collapsed={collapsed} />
      </aside>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background shadow-xl outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <Sidebar view={view} onNavigate={() => setDrawerOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>

          <div className="mx-1 hidden h-5 w-px bg-border lg:block" />

          <div className="min-w-0">
            <h1 className="truncate text-base leading-tight font-semibold">{item.title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {item.subtitle}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <span className="hidden text-sm text-muted-foreground xl:inline">{today}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
              onClick={toggle}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
