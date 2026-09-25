import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMatches } from "@tanstack/react-router";
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QuickLogButton } from "#components/finance/quick-log/QuickLogButton";
import { QuickLogSheet } from "#components/finance/quick-log/QuickLogSheet";
import { Sidebar } from "#components/layout/Sidebar";
import { Toaster } from "#components/layout/Toaster";
import { Button } from "#components/ui/button";
import { useStoredState } from "#hooks/useStoredState";
import { useTheme } from "#hooks/useTheme";
import { LANGUAGES, type Language, currentLanguage, setLanguage } from "#i18n/i18n";
import { formatLongDate } from "#lib/dates";
import { cn } from "#lib/utils";

interface Props {
  /** Extra controls for the app bar's right side, owned by the open page. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Full-viewport dashboard frame: a sidebar (an icon rail when collapsed on
 * desktop, a slide-in drawer below `lg`), a sticky app bar, and a scrolling
 * content area that pages fill edge to edge.
 */
export function AppShell({ actions, children }: Props) {
  const [collapsed, setCollapsed] = useStoredState("lifeos.sidebarCollapsed", false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const page = usePageMeta();
  const today = formatLongDate(new Date());

  return (
    <div className="flex h-svh overflow-hidden bg-muted/30">
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-background transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background shadow-xl outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">
              {t("shell.appBar.navigation")}
            </DialogPrimitive.Title>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t("shell.appBar.openNavigation")}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            aria-label={
              collapsed ? t("shell.appBar.expandSidebar") : t("shell.appBar.collapseSidebar")
            }
            title={collapsed ? t("shell.appBar.expandSidebar") : t("shell.appBar.collapseSidebar")}
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
            <h1 className="truncate text-base leading-tight font-semibold">{page.title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {page.subtitle}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <span className="hidden text-sm text-muted-foreground xl:inline">{today}</span>
            <LanguageSwitch />
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                theme === "dark" ? t("shell.appBar.switchToLight") : t("shell.appBar.switchToDark")
              }
              title={theme === "dark" ? t("shell.appBar.lightMode") : t("shell.appBar.darkMode")}
              onClick={toggle}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </header>

        <main
          id="main"
          data-scroll-restoration-id="main"
          className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-28"
        >
          {children}
        </main>
      </div>

      <QuickLogButton />
      <QuickLogSheet />
      <Toaster />
    </div>
  );
}

/**
 * The open page's title and subtitle, from the deepest matched route that
 * names its page in `staticData`. Also keeps the browser tab title in sync.
 */
function usePageMeta(): { title: string; subtitle?: string } {
  const { t } = useTranslation();
  const page = useMatches({
    select: (matches) => matches.findLast((match) => match.staticData.page)?.staticData.page,
  });
  const appName = t("shell.appName");
  const title = page ? t(`shell.pages.${page}.title`) : appName;

  useEffect(() => {
    document.title = page ? `${title} · ${appName}` : appName;
  }, [page, title, appName]);

  return { title, subtitle: page ? t(`shell.pages.${page}.subtitle`) : undefined };
}

/** EN | VI: switches the whole app, and is remembered. */
function LanguageSwitch() {
  const { t } = useTranslation();
  const active = currentLanguage();
  return (
    <fieldset className="flex h-8 items-center rounded-md border p-0.5 text-xs font-medium">
      <legend className="sr-only">{t("shell.appBar.language")}</legend>
      {(Object.keys(LANGUAGES) as Language[]).map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          aria-pressed={active === language}
          title={LANGUAGES[language].label}
          onClick={() => setLanguage(language)}
          className={cn(
            "h-full rounded px-2 transition-colors",
            active === language
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LANGUAGES[language].short}
        </button>
      ))}
    </fieldset>
  );
}
