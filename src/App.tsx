/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Users,
  AlertTriangle,
  BarChart3,
  UserCheck,
  ShieldCheck,
  LogOut,
  LogIn,
  Kanban,
  Bell,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Lead, LeadStatus } from "./types";
import { useAppData } from "./state/AppDataContext";
import { PedidosTab } from "./features/pedidos/PedidosTab";
import { FaltantesTab } from "./features/faltantes/FaltantesTab";
import { AdminTab } from "./features/admin/AdminTab";
import { KanbanTab } from "./features/leads/KanbanTab";
import { MyLeadsTab } from "./features/leads/MyLeadsTab";
import { PerformanceTab } from "./features/performance/PerformanceTab";
import { NewLeadDialog } from "./features/leads/NewLeadDialog";
import { StatusUpdateDialog, type StatusUpdateDialogHandle } from "./features/leads/StatusUpdateDialog";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export default function App() {
  // Server data + auth + lifecycle live in AppDataContext (see src/state/AppDataContext.tsx).
  // Component-local state (filters, dialogs, forms) stays here until each tab is extracted.
  const {
    leads, users,
    currentUser, setCurrentUser, loading,
    refetchAll,
  } = useAppData();


  // Pedidos extraordinarios state now lives inside features/pedidos/PedidosTab.

  // "Nuevo Lead" + status-update dialog state now lives in their feature
  // folders. Kanban + My Leads + Performance filter/goals state too.
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const statusDialogRef = useRef<StatusUpdateDialogHandle>(null);
  const openStatusUpdate = useCallback(
    (lead: Lead, newStatus?: LeadStatus) => statusDialogRef.current?.open(lead, newStatus),
    []
  );

  const notifications = useMemo(() => {
    if (!currentUser) return [] as Array<{ id: string; leadId: string; kind: "stale-assignment" | "stale-quote"; lead: Lead; days: number; sellerName: string }>;
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;
    const visible = currentUser.role === "Admin"
      ? leads
      : leads.filter(l => l.assignedTo === currentUser.id);
    const out: Array<{ id: string; leadId: string; kind: "stale-assignment" | "stale-quote"; lead: Lead; days: number; sellerName: string }> = [];
    for (const lead of visible) {
      if (!lead.assignedTo) continue;
      const days = Math.floor((now - new Date(lead.updatedAt).getTime()) / DAY);
      const sellerName = users.find(u => u.id === lead.assignedTo)?.name || "Sin asignar";
      if (lead.status === "ASIGNADO" && days >= 3) {
        out.push({ id: `assign-${lead.id}`, leadId: lead.id, kind: "stale-assignment", lead, days, sellerName });
      } else if (lead.status === "COTIZADO" && days >= 5) {
        out.push({ id: `quote-${lead.id}`, leadId: lead.id, kind: "stale-quote", lead, days, sellerName });
      }
    }
    return out.sort((a, b) => b.days - a.days);
  }, [leads, users, currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (res.ok) {
        const user = await res.json();
        // setCurrentUser persists to localStorage; the role-based useEffect
        // above handles perf filter + goals timeline. Just refresh data.
        setCurrentUser(user);
        toast.success(`Bienvenido de nuevo, ${user.name}`);
        refetchAll();
      } else {
        const data = await res.json();
        toast.error(data.error || "Correo o contraseña incorrectos");
      }
    } catch (error) {
      toast.error("Error al iniciar sesión");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    toast.info("Sesión cerrada exitosamente");
  };


  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-navy">
        <div className="absolute top-0 inset-x-0 h-1 bg-brand-red" />
        <Toaster position="top-right" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-white overflow-hidden pt-0">
            <div className="h-2 bg-white" />
            <CardHeader className="text-center space-y-2 pt-8">
              <img src="https://ecosistemas.com.mx/cdn/shop/files/logoeco.png?v=1758568786&width=260" alt="Ecosistemas" className="h-14 object-contain mx-auto mb-2" />
              <p className="text-sm font-semibold text-brand-navy">Panel de ventas</p>
              <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-brand-navy ml-1">Correo Electrónico</label>
                    <Input
                      type="email"
                      placeholder="nombre@empresa.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-brand-navy ml-1">Contraseña</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 gap-2 text-base font-semibold">
                  <LogIn className="w-5 h-5" />
                  Iniciar sesión
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-white/70 mt-4">Ecosistemas · Soluciones Innovadoras</p>
        </motion.div>
      </div>
    );
  }

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
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white border-b-2 border-brand-red">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://ecosistemas.com.mx/cdn/shop/files/logoeco.png?v=1758568786&width=260" alt="Ecosistemas" className="h-8 object-contain" />
            <span className="hidden sm:inline-block h-6 w-px bg-slate-200" />
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-brand-navy">CRM</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-brand-navy">{currentUser.name}</span>
              <span className="text-xs text-brand-gray">{currentUser.role}</span>
            </div>
            <Popover>
              <PopoverTrigger nativeButton={false} render={
                <div className="relative w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border border-slate-200 cursor-pointer hover:bg-slate-300 transition-colors">
                  <Bell className="w-5 h-5 text-slate-600" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                      {notifications.length}
                    </span>
                  )}
                </div>
              } />
              <PopoverContent align="end" className="w-80 p-0">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <span className="font-semibold text-sm">Alertas</span>
                  <Badge variant="secondary" className="text-xs">{notifications.length}</Badge>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      Sin alertas pendientes
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => openStatusUpdate(n.lead)}
                        className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={cn("w-4 h-4 mt-0.5 flex-shrink-0", n.kind === "stale-quote" ? "text-red-500" : "text-amber-500")} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{n.lead.name}</p>
                            <p className="text-xs text-slate-500 truncate">{n.lead.company}</p>
                            <p className="text-xs mt-1" style={{color: "#141456"}}>
                              {n.kind === "stale-quote"
                                ? `Cotización sin actualizar hace ${n.days} días`
                                : `Lead asignado sin actualizar hace ${n.days} días`}
                            </p>
                            {currentUser.role === "Admin" && (
                              <p className="text-[10px] text-slate-400 mt-0.5">Vendedor: {n.sellerName}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Dialog>
              <DialogTrigger nativeButton={false} render={
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border border-slate-200 cursor-pointer hover:bg-slate-300 transition-colors">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
              } />
              <DialogContent className="sm:max-w-[300px]">
                <DialogHeader>
                  <DialogTitle>Cuenta</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{currentUser.name}</p>
                      <p className="text-xs text-slate-500">{currentUser.email}</p>
                    </div>
                  </div>
                  <Button variant="destructive" className="w-full gap-2" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <Tabs defaultValue={currentUser.role === "Compras" ? "pedidos" : currentUser.role === "Admin" ? "admin" : "my-leads"} className="space-y-6 md:space-y-8">
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

      {/* Cross-cutting status-update dialog — opened imperatively via statusDialogRef. */}
      <StatusUpdateDialog ref={statusDialogRef} />
    </div>
  );
}


