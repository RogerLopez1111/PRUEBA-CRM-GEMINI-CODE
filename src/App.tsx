/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, BarChart3, UserCheck, ShieldCheck, Kanban, Clock, ListChecks,
  ChevronDown, Menu, Users, Activity, Target, TrendingUp, X,
} from "lucide-react";

import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import { useAppData } from "./state/AppDataContext";
import type { Lead, LeadStatus } from "./types";

import { LoginScreen } from "./features/auth/LoginScreen";
import { AppHeader } from "./features/shell/AppHeader";
import { PedidosTab } from "./features/pedidos/PedidosTab";
import { TareasTab } from "./features/tareas/TareasTab";
import { FaltantesTab } from "./features/faltantes/FaltantesTab";
import { AdminTab } from "./features/admin/AdminTab";
import { KanbanTab } from "./features/leads/KanbanTab";
import { MyLeadsTab } from "./features/leads/MyLeadsTab";
import { PerformanceTab } from "./features/performance/PerformanceTab";
import { NewLeadDialog } from "./features/leads/NewLeadDialog";
import { StatusUpdateDialog, type StatusUpdateDialogHandle } from "./features/leads/StatusUpdateDialog";

// Admin sub-sections, mirrored by the "Panel Admin" sidebar dropdown and by the
// in-place sub-tab header that stays inside AdminTab.
const ADMIN_SUBITEMS: { value: string; label: string; icon: typeof Users }[] = [
  { value: "users", label: "Usuarios", icon: Users },
  { value: "workload", label: "Carga de Trabajo", icon: BarChart3 },
  { value: "activity", label: "Actividad Global", icon: Activity },
  { value: "goals", label: "Metas por Sucursal", icon: Target },
  { value: "rentabilidad", label: "Rentabilidad", icon: TrendingUp },
];

export default function App() {
  const { currentUser, loading } = useAppData();

  // Single status-update dialog shared by Kanban, My Leads, Admin, and the
  // notifications popover. Opened imperatively via the ref handle below.
  const statusDialogRef = useRef<StatusUpdateDialogHandle>(null);
  const openStatusUpdate = useCallback(
    (lead: Lead, newStatus?: LeadStatus, opts?: { forceStageForm?: boolean }) =>
      statusDialogRef.current?.open(lead, newStatus, opts),
    []
  );

  // Main navigation is a controlled Tabs so the lateral sidebar buttons and the
  // Admin dropdown sub-items can drive the active section directly.
  const [activeTab, setActiveTab] = useState<string>(
    currentUser?.role === "Compras" ? "faltantes" : currentUser?.role === "Admin" ? "performance" : "my-leads"
  );
  // Admin sub-tab is lifted here so the sidebar dropdown and AdminTab's own
  // in-place sub-tab header share the same selection.
  const [adminSubTab, setAdminSubTab] = useState<string>("users");
  // Admin submenu starts expanded for admins (their default landing section).
  const [adminExpanded, setAdminExpanded] = useState<boolean>(currentUser?.role === "Admin");
  // Sidebar is a slide-in drawer, hidden by default and auto-closed after the
  // user picks a section (same behavior on mobile and desktop).
  const [navOpen, setNavOpen] = useState(false);

  // currentUser is null on first render (rehydrated async from /api/me or set
  // by login), so the useState initializer above can't key off the role — it
  // always falls through to "my-leads". Apply the role's landing section once,
  // the first time the user becomes known. Reset on logout so a different role
  // lands correctly on the next login.
  const landedRef = useRef(false);
  useEffect(() => {
    if (!currentUser) { landedRef.current = false; return; }
    if (landedRef.current) return;
    landedRef.current = true;
    if (currentUser.role === "Admin") setActiveTab("performance");
    else if (currentUser.role === "Compras") setActiveTab("faltantes");
    // Sellers keep the "my-leads" default.
  }, [currentUser]);

  if (!currentUser) return <LoginScreen />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-red/20" />
          <p className="text-brand-navy font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  const isSeller = currentUser.role !== "Compras";

  // Reusable sidebar nav button.
  const NavButton = ({
    value, label, icon: Icon,
  }: { value: string; label: string; icon: typeof Users }) => {
    const active = activeTab === value;
    return (
      <button
        onClick={() => { setActiveTab(value); setNavOpen(false); }}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors border-l-2",
          active
            ? "bg-brand-navy/5 text-brand-navy border-brand-red"
            : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-brand-navy"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Toaster position="top-right" />
      <AppHeader openStatusUpdate={openStatusUpdate} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="block gap-0">
        {/* Hover hotzone — move the mouse to the left edge to reveal the drawer */}
        <div
          onMouseEnter={() => setNavOpen(true)}
          aria-hidden
          className="hidden md:block fixed top-16 left-0 z-20 w-2 h-[calc(100vh-4rem)]"
        />

        {/* Backdrop — fades in with the drawer, click-away closes it */}
        <div
          onClick={() => setNavOpen(false)}
          aria-hidden
          className={cn(
            "fixed inset-x-0 bottom-0 top-16 z-20 bg-slate-900/20 transition-opacity duration-300",
            navOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        />

        {/* Lateral sidebar — slide-in drawer (GPU-friendly transform transition) */}
        <aside
          onMouseLeave={() => setNavOpen(false)}
          className={cn(
            "fixed top-16 left-0 z-30 w-64 h-[calc(100vh-4rem)] bg-white border-r border-slate-200 overflow-y-auto",
            "transition-transform duration-300 ease-in-out will-change-transform",
            navOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-4 h-12 border-b border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-navy">Menú</span>
            <button
              onClick={() => setNavOpen(false)}
              title="Cerrar menú"
              className="p-1 text-slate-400 hover:text-brand-navy transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className="py-4">
            {isSeller && (
              <>
                <NavButton value="my-leads" label="Mis Leads" icon={UserCheck} />
                <NavButton value="kanban" label="Pipeline" icon={Kanban} />
                <NavButton value="performance" label="Rendimiento" icon={BarChart3} />
                <NavButton value="tareas" label="Tareas" icon={ListChecks} />
              </>
            )}
            <NavButton value="faltantes" label="Faltantes" icon={AlertTriangle} />
            <NavButton value="pedidos" label="Pedidos Extraordinarios" icon={Clock} />

            {currentUser.role === "Admin" && (
              <div>
                {/* Dropdown header — navigates to Admin and toggles the submenu */}
                <button
                  onClick={() => { setActiveTab("admin"); setAdminExpanded((v) => !v); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-left transition-colors border-l-2",
                    activeTab === "admin"
                      ? "bg-brand-navy/5 text-brand-navy border-brand-red"
                      : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-brand-navy"
                  )}
                >
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">Panel Admin</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", adminExpanded && "rotate-180")} />
                </button>

                {/* Submenu — jumps straight to the matching Admin sub-tab */}
                {adminExpanded && (
                  <div className="py-1">
                    {ADMIN_SUBITEMS.map((sub) => {
                      const active = activeTab === "admin" && adminSubTab === sub.value;
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.value}
                          onClick={() => {
                            setActiveTab("admin");
                            setAdminSubTab(sub.value);
                            setNavOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 pl-11 pr-4 py-2 text-[13px] text-left transition-colors border-l-2",
                            active
                              ? "text-brand-navy font-semibold border-brand-red bg-brand-navy/5"
                              : "text-slate-500 border-transparent hover:bg-slate-50 hover:text-brand-navy"
                          )}
                        >
                          <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>
        </aside>

        {/* Content */}
        <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setNavOpen((v) => !v)}
              title="Menú"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-navy transition-colors"
            >
              <Menu className="w-5 h-5" />
              <span>Menú</span>
            </button>
            <NewLeadDialog />
          </div>

          <TabsContent value="my-leads" className="space-y-6">
            <MyLeadsTab openStatusUpdate={openStatusUpdate} />
          </TabsContent>

          <TabsContent value="kanban" className="space-y-6">
            <KanbanTab openStatusUpdate={openStatusUpdate} />
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <PerformanceTab />
          </TabsContent>

          <TabsContent value="tareas" className="space-y-6">
            <TareasTab />
          </TabsContent>

          <TabsContent value="faltantes" className="space-y-6">
            <FaltantesTab />
          </TabsContent>

          <TabsContent value="pedidos" className="space-y-6">
            <PedidosTab />
          </TabsContent>

          {currentUser.role === "Admin" && (
            <TabsContent value="admin" className="space-y-6">
              <AdminTab
                openStatusUpdate={openStatusUpdate}
                subTab={adminSubTab}
                setSubTab={setAdminSubTab}
              />
            </TabsContent>
          )}
        </main>
      </Tabs>

      <StatusUpdateDialog ref={statusDialogRef} />
    </div>
  );
}
