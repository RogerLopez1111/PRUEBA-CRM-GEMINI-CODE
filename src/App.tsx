/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef } from "react";
import {
  AlertTriangle, BarChart3, UserCheck, ShieldCheck, Kanban, Clock,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

import { useAppData } from "./state/AppDataContext";
import type { Lead, LeadStatus } from "./types";

import { LoginScreen } from "./features/auth/LoginScreen";
import { AppHeader } from "./features/shell/AppHeader";
import { PedidosTab } from "./features/pedidos/PedidosTab";
import { FaltantesTab } from "./features/faltantes/FaltantesTab";
import { AdminTab } from "./features/admin/AdminTab";
import { KanbanTab } from "./features/leads/KanbanTab";
import { MyLeadsTab } from "./features/leads/MyLeadsTab";
import { PerformanceTab } from "./features/performance/PerformanceTab";
import { NewLeadDialog } from "./features/leads/NewLeadDialog";
import { StatusUpdateDialog, type StatusUpdateDialogHandle } from "./features/leads/StatusUpdateDialog";

export default function App() {
  const { currentUser, loading } = useAppData();

  // Single status-update dialog shared by Kanban, My Leads, Admin, and the
  // notifications popover. Opened imperatively via the ref handle below.
  const statusDialogRef = useRef<StatusUpdateDialogHandle>(null);
  const openStatusUpdate = useCallback(
    (lead: Lead, newStatus?: LeadStatus) => statusDialogRef.current?.open(lead, newStatus),
    []
  );

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

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Toaster position="top-right" />
      <AppHeader openStatusUpdate={openStatusUpdate} />

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <Tabs
          defaultValue={currentUser.role === "Compras" ? "pedidos" : currentUser.role === "Admin" ? "admin" : "my-leads"}
          className="space-y-6 md:space-y-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList variant="line" className="h-12 w-full md:w-auto overflow-x-auto border-b">
              {currentUser.role !== "Compras" && (
                <>
                  <TabsTrigger value="my-leads" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                    <UserCheck className="w-4 h-4" />
                    <span className="hidden sm:inline">Mis Leads</span>
                  </TabsTrigger>
                  <TabsTrigger value="kanban" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                    <Kanban className="w-4 h-4" />
                    <span className="hidden sm:inline">Pipeline</span>
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Rendimiento</span>
                  </TabsTrigger>
                  <TabsTrigger value="faltantes" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="hidden sm:inline">Faltantes</span>
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="pedidos" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Pedidos Extraordinarios</span>
              </TabsTrigger>
              {currentUser.role === "Admin" && (
                <TabsTrigger value="admin" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Panel Admin</span>
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex items-center gap-2">
              <NewLeadDialog />
            </div>
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

          <TabsContent value="faltantes" className="space-y-6">
            <FaltantesTab />
          </TabsContent>

          <TabsContent value="pedidos" className="space-y-6">
            <PedidosTab />
          </TabsContent>

          {currentUser.role === "Admin" && (
            <TabsContent value="admin" className="space-y-6">
              <AdminTab openStatusUpdate={openStatusUpdate} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <StatusUpdateDialog ref={statusDialogRef} />
    </div>
  );
}
