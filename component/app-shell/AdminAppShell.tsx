"use client";

import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  CalendarDays,
  Database,
  FolderKanban,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  PanelLeftClose,
  PiggyBank,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { LoadingLink } from "@/component/GlobalLoading";
import { ERP_UI_TEXT } from "@/lib/i18n/vi";
import {
  findAdminNavigationItem,
  isAdminNavigationItemActive,
  type AdminNavigationGroup,
  type AdminNavigationIcon,
} from "@/lib/navigation/admin";
import AdminLogoutButton from "@/app/admin/AdminLogoutButton";

const ICONS: Record<AdminNavigationIcon, ElementType> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  employees: Users,
  attendance: CalendarDays,
  facilities: MapPin,
  accounts: ShieldCheck,
  capital: PiggyBank,
  payroll: WalletCards,
  metadata: Database,
  emailTemplates: Mail,
};

function AppSidebar({
  groups,
  open,
  canSwitchWorkspace,
  onClose,
}: {
  groups: readonly AdminNavigationGroup[];
  open: boolean;
  canSwitchWorkspace: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open ? (
        <button
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-label={ERP_UI_TEXT.navigation.close}
        />
      ) : null}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <div>
            <p className="text-sm font-extrabold tracking-[0.12em] text-blue-400">
              {ERP_UI_TEXT.brand.name}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">
              {ERP_UI_TEXT.brand.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="admin-icon-button lg:hidden"
            aria-label={ERP_UI_TEXT.navigation.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav
          className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5"
          aria-label={ERP_UI_TEXT.navigation.ariaLabel}
        >
          {groups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-wide text-slate-500">
                {group.groupTitle}
              </p>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isAdminNavigationItemActive(pathname, item.path);

                return (
                  <LoadingLink
                    key={item.path}
                    href={item.path}
                    loadingMessage="Đang tải dữ liệu..."
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={`admin-nav-item ${active ? "admin-nav-item-active" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.name}</span>
                  </LoadingLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t p-3">
          {canSwitchWorkspace ? (
            <div className="rounded-xl border bg-slate-950/60 p-2">
              <p className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500">
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                {ERP_UI_TEXT.workspace.switchLabel}
              </p>
              <LoadingLink
                href="/staff"
                loadingMessage="Đang mở khu vực nhân viên..."
                className="admin-nav-item"
              >
                <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                {ERP_UI_TEXT.workspace.switchToStaff}
              </LoadingLink>
            </div>
          ) : null}
          <AdminLogoutButton />
        </div>
      </aside>
    </>
  );
}

function GlobalCommandMenu({
  groups,
  open,
  onClose,
}: {
  groups: readonly AdminNavigationGroup[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const items = useMemo(
    () =>
      groups
        .flatMap((group) => group.items)
        .filter((item) => item.name.toLocaleLowerCase("vi").includes(normalizedQuery)),
    [groups, normalizedQuery],
  );
  const closeMenu = () => {
    setQuery("");
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="admin-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-command-title"
      aria-describedby="admin-command-description"
      onKeyDown={(event) => {
        if (event.key === "Escape") closeMenu();
      }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={closeMenu}
        aria-label={ERP_UI_TEXT.commandMenu.close}
      />
      <div className="admin-command-panel relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl">
        <div className="flex items-start gap-3 border-b p-4">
          <Search className="mt-0.5 h-5 w-5 text-blue-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="admin-command-title" className="text-sm font-bold text-slate-100">
              {ERP_UI_TEXT.commandMenu.title}
            </h2>
            <p id="admin-command-description" className="mt-0.5 text-xs text-slate-500">
              {ERP_UI_TEXT.commandMenu.description}
            </p>
          </div>
          <button type="button" className="admin-icon-button" onClick={closeMenu} aria-label={ERP_UI_TEXT.commandMenu.close}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b p-3">
          <label className="sr-only" htmlFor="admin-command-search">
            {ERP_UI_TEXT.commandMenu.placeholder}
          </label>
          <input
            ref={inputRef}
            id="admin-command-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ERP_UI_TEXT.commandMenu.placeholder}
            className="admin-field"
          />
        </div>
        <div className="custom-scrollbar max-h-[min(24rem,60vh)] overflow-y-auto p-2">
          {items.length > 0 ? (
            items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <LoadingLink
                  key={item.path}
                  href={item.path}
                  loadingMessage="Đang tải dữ liệu..."
                  onClick={closeMenu}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {item.name}
                </LoadingLink>
              );
            })
          ) : (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {ERP_UI_TEXT.commandMenu.empty}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AppHeader({
  groups,
  onOpenNavigation,
  onOpenCommandMenu,
}: {
  groups: readonly AdminNavigationGroup[];
  onOpenNavigation: () => void;
  onOpenCommandMenu: () => void;
}) {
  const pathname = usePathname();
  const currentItem = findAdminNavigationItem(groups, pathname);
  const currentName = currentItem?.name || ERP_UI_TEXT.breadcrumb.currentFallback;

  return (
    <header className="admin-header sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b px-4 py-2 backdrop-blur-md sm:px-6 lg:px-8">
      <button type="button" onClick={onOpenNavigation} className="admin-icon-button lg:hidden" aria-label={ERP_UI_TEXT.navigation.open}>
        <Menu className="h-5 w-5" />
      </button>
      <PanelLeftClose className="hidden h-4 w-4 text-slate-600 lg:block" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-100">{currentName}</p>
        <p className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex">
          <span>{ERP_UI_TEXT.breadcrumb.root}</span>
          <span aria-hidden="true">/</span>
          <span className="truncate">{currentName}</span>
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onOpenCommandMenu} className="admin-search-button" aria-keyshortcuts="Control+K Meta+K">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{ERP_UI_TEXT.commandMenu.open}</span>
          <kbd className="hidden rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 md:inline">
            {ERP_UI_TEXT.commandMenu.shortcut}
          </kbd>
        </button>
        <div className="rounded-full border px-3 py-1.5 text-[11px] font-medium text-slate-400">
          {ERP_UI_TEXT.workspace.admin}
        </div>
      </div>
    </header>
  );
}

export function MainContent({ children }: { children: ReactNode }) {
  return <main className="admin-main min-w-0">{children}</main>;
}

export function AdminAppShell({
  children,
  navigationGroups,
  canSwitchWorkspace,
}: {
  children: ReactNode;
  navigationGroups: readonly AdminNavigationGroup[];
  canSwitchWorkspace: boolean;
}) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandMenuOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <div className="admin-shell min-h-screen text-slate-100">
      <AppSidebar
        groups={navigationGroups}
        open={mobileNavigationOpen}
        canSwitchWorkspace={canSwitchWorkspace}
        onClose={() => setMobileNavigationOpen(false)}
      />
      <div className="min-w-0 lg:pl-64">
        <AppHeader
          groups={navigationGroups}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
          onOpenCommandMenu={() => setCommandMenuOpen(true)}
        />
        <MainContent>{children}</MainContent>
      </div>
      <GlobalCommandMenu
        groups={navigationGroups}
        open={commandMenuOpen}
        onClose={() => setCommandMenuOpen(false)}
      />
    </div>
  );
}
