import { useState } from "react";
import {
  Settings, UserPlus, Users, Filter, AlertTriangle, CheckCircle2, Clock, History, Target, Building2, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { MESES, getStuckLevel, getTimeStuck } from "../../lib/helpers";
import { useAppData } from "../../state/AppDataContext";
import type { Lead, SalesGoal, User } from "../../types";
import { useWorkloadInsights } from "./useWorkloadInsights";
import { getStatusBadge } from "../leads/getStatusBadge";

export interface AdminTabProps {
  openStatusUpdate: (lead: Lead) => void;
}

const NEW_USER_BLANK = { name: "", email: "", role: "Seller" as "Admin" | "Seller" | "Compras", salesGoal: 50000, sucursal: "" };
const BRANCH_GOAL_BLANK = () => ({
  sucursalId: "",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  amount: 0,
});

export function AdminTab({ openStatusUpdate }: AdminTabProps) {
  const { leads, users, sucursales, segmentos, refetchAll } = useAppData();

  // Sub-tab routing
  const [subTab, setSubTab] = useState<string>("users");

  // Filters shared by Users / Workload / Activity
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [filterSucursal, setFilterSucursal] = useState<string>("all");
  const [filterSegmento, setFilterSegmento] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [filterClientInitiated, setFilterClientInitiated] = useState(false);
  const [filterMostrador, setFilterMostrador] = useState(false);
  const [filterNewClient, setFilterNewClient] = useState(false);

  // Actividad Global date interval (YYYY-MM-DD strings from <input type="date">)
  const [activityFrom, setActivityFrom] = useState<string>("");
  const [activityTo, setActivityTo] = useState<string>("");

  // New-user dialog
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [newUser, setNewUser] = useState(NEW_USER_BLANK);

  // User-detail dialog
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [userDetailEmail, setUserDetailEmail] = useState("");
  const [userDetailPassword, setUserDetailPassword] = useState("");
  const [userGoalsTimeline, setUserGoalsTimeline] = useState<SalesGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  // Branch-goal setter
  const [branchGoal, setBranchGoal] = useState(BRANCH_GOAL_BLANK());

  const workloadInsights = useWorkloadInsights({
    vendedor: filterSeller,
    sucursal: filterSucursal,
    search,
    clientInitiated: filterClientInitiated,
    mostrador: filterMostrador,
    newClient: filterNewClient,
  });

  const fetchGoalsTimeline = async (userId: string) => {
    setGoalsLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/goals`);
      if (res.ok) setUserGoalsTimeline(await res.json());
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleOpenUserDetail = (user: User) => {
    setSelectedUserDetail(user);
    setUserDetailEmail(user.email);
    setUserDetailPassword("");
    fetchGoalsTimeline(user.id);
  };

  const handleUpdateUserEmail = async () => {
    if (!selectedUserDetail) return;
    try {
      const res = await fetch(`/api/users/${selectedUserDetail.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userDetailEmail }),
      });
      if (res.ok) {
        toast.success("Correo actualizado");
        refetchAll();
        setSelectedUserDetail((prev) => (prev ? { ...prev, email: userDetailEmail } : null));
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar correo");
      }
    } catch {
      toast.error("Error al actualizar correo");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserDetail || !userDetailPassword) return;
    try {
      const res = await fetch(`/api/users/${selectedUserDetail.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: userDetailPassword }),
      });
      if (res.ok) {
        toast.success("Contraseña actualizada");
        setUserDetailPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar contraseña");
      }
    } catch {
      toast.error("Error al actualizar contraseña");
    }
  };

  const handleUpdateRole = async (userId: string, role: "Admin" | "Seller" | "Compras") => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        toast.success("Rol de usuario actualizado");
        refetchAll();
      }
    } catch {
      toast.error("Error al actualizar rol");
    }
  };

  const handleUpdateGoal = async (userId: string, goal: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (res.ok) {
        toast.success("Meta de ventas actualizada");
        refetchAll();
      }
    } catch {
      toast.error("Error al actualizar meta");
    }
  };

  const handleSetBranchGoal = async () => {
    if (!branchGoal.sucursalId || !branchGoal.amount) return;
    try {
      const res = await fetch(`/api/sucursales/${branchGoal.sucursalId}/goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: branchGoal.amount, year: branchGoal.year, month: branchGoal.month }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Meta aplicada a ${data.updated} vendedor(es)`);
        refetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al establecer meta");
      }
    } catch {
      toast.error("Error al establecer meta");
    }
  };

  const handleCreateUser = async () => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        toast.success("Nuevo usuario creado exitosamente");
        setIsNewUserOpen(false);
        setNewUser(NEW_USER_BLANK);
        refetchAll();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear usuario");
      }
    } catch {
      toast.error("Error al crear usuario");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Centro de Administración</h2>
          <p className="text-slate-500">Gestiona roles de usuario, metas y supervisa la carga de trabajo del equipo.</p>
        </div>
        <Tabs value={subTab} onValueChange={setSubTab} className="w-full md:w-auto">
          <TabsList variant="line" className="border-b">
            <TabsTrigger value="users" className="text-xs px-4">Usuarios</TabsTrigger>
            <TabsTrigger value="workload" className="text-xs px-4">Carga de Trabajo</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs px-4">Actividad Global</TabsTrigger>
            <TabsTrigger value="goals" className="text-xs px-4">Metas por Sucursal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {subTab === "users" && (
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-400" />
                    Gestión de Usuarios
                  </CardTitle>
                  <CardDescription>Asigna roles y establece objetivos de ventas individuales.</CardDescription>
                </div>
                <Dialog open={isNewUserOpen} onOpenChange={setIsNewUserOpen}>
                  <DialogTrigger render={<Button className="gap-2" />}>
                    <UserPlus className="w-4 h-4" />
                    Agregar Usuario
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Nuevo Miembro al Equipo</DialogTitle>
                      <DialogDescription>Crea una nueva cuenta de usuario para el CRM.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Nombre Completo</label>
                        <Input placeholder="Juan Pérez" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Correo Electrónico</label>
                        <Input type="email" placeholder="juan@ecosistemas.com.mx" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Rol</label>
                          <Select value={newUser.role} onValueChange={(val) => setNewUser({ ...newUser, role: val as "Admin" | "Seller" | "Compras" })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Admin">Admin</SelectItem>
                              <SelectItem value="Seller">Vendedor</SelectItem>
                              <SelectItem value="Compras">Compras</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Sucursal</label>
                          <Select value={newUser.sucursal} onValueChange={(val) => setNewUser({ ...newUser, sucursal: val })}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              {sucursales.map((s) => (
                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Meta de Ventas ($)</label>
                        <Input type="number" value={newUser.salesGoal || ""} onChange={(e) => setNewUser({ ...newUser, salesGoal: Number(e.target.value) })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>Cancelar</Button>
                      <Button onClick={handleCreateUser} disabled={!newUser.name || !newUser.email}>Crear Usuario</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <div className="px-6 py-3 border-b flex flex-wrap gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-gray">Sucursal</p>
                <Select value={filterSucursal} onValueChange={setFilterSucursal}>
                  <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Todas las Sucursales" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
                    {sucursales.map((s) => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-gray">Segmento</p>
                <Select value={filterSegmento} onValueChange={setFilterSegmento}>
                  <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Todos los Segmentos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Segmentos</SelectItem>
                    {segmentos.map((s) => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-semibold">Usuario</TableHead>
                      <TableHead className="font-semibold">Rol</TableHead>
                      <TableHead className="font-semibold">Meta de Ventas ($)</TableHead>
                      <TableHead className="text-right font-semibold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users
                      .filter((user) => {
                        if (filterSucursal !== "all" && user.sucursalId !== sucursales.find((s) => s.name === filterSucursal)?.id) return false;
                        if (filterSegmento !== "all" && !leads.some((l) => l.assignedTo === user.id && l.segmento === filterSegmento)) return false;
                        return true;
                      })
                      .map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{user.name}</span>
                              <span className="text-xs text-slate-400">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={user.role} onValueChange={(val) => handleUpdateRole(user.id, val as "Admin" | "Seller" | "Compras")}>
                              <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="Seller">Vendedor</SelectItem>
                                <SelectItem value="Compras">Compras</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-28 h-8"
                                defaultValue={user.performance.salesGoal}
                                onBlur={(e) => {
                                  const newVal = Number(e.target.value);
                                  if (newVal !== user.performance.salesGoal) handleUpdateGoal(user.id, newVal);
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => handleOpenUserDetail(user)}>Ver Detalles</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Detail Dialog (rendered alongside Users panel so subtab switching keeps it open if needed) */}
        <Dialog open={!!selectedUserDetail} onOpenChange={(open) => { if (!open) setSelectedUserDetail(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                {selectedUserDetail?.name}
              </DialogTitle>
              <DialogDescription>
                {selectedUserDetail?.role === "Admin" ? "Administrador" : "Vendedor"} · ID: {selectedUserDetail?.id}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2 max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400">Leads activos</p>
                  <p className="text-xl font-bold">{selectedUserDetail?.workload?.activeLeads ?? 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400">Cerrados</p>
                  <p className="text-xl font-bold">{selectedUserDetail?.performance.totalClosed ?? 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs text-slate-400">Pipeline</p>
                  <p className="text-xl font-bold">${((selectedUserDetail?.workload?.pipelineValue ?? 0) / 1000).toFixed(0)}k</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-brand-gray mb-1">Sucursal</p>
                  <p>{sucursales.find((s) => s.id === selectedUserDetail?.sucursalId)?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-brand-gray mb-1">Meta del mes</p>
                  <p>${(selectedUserDetail?.performance.salesGoal ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-brand-gray mb-1">Valor cerrado</p>
                  <p>${(selectedUserDetail?.performance.totalValue ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-brand-gray mb-1">Conversión</p>
                  <p>{((selectedUserDetail?.performance.conversionRate ?? 0) * 100).toFixed(0)}%</p>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold">Historial de Metas</p>
                {goalsLoading ? (
                  <p className="text-xs text-slate-400">Cargando...</p>
                ) : userGoalsTimeline.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin metas registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {userGoalsTimeline.map((g) => {
                      const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                      const pct = g.meta > 0 ? Math.min(100, Math.round((g.invoiced / g.meta) * 100)) : 0;
                      const label = `${MONTHS[g.month - 1]} ${g.year}`;
                      const badgeClass = g.status === "achieved" ? "bg-green-50 text-green-700 border-green-200"
                        : g.status === "missed" ? "bg-red-50 text-red-700 border-red-200"
                        : g.status === "current" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-50 text-slate-500 border-slate-200";
                      const badgeLabel = g.status === "achieved" ? "Cumplida" : g.status === "missed" ? "No cumplida" : g.status === "current" ? "En curso" : "Próxima";
                      return (
                        <div key={g.id} className="rounded-lg border p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{label}</span>
                            <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>{badgeLabel}</Badge>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Meta: <span className="font-semibold text-slate-700">${g.meta.toLocaleString()}</span></span>
                            <span>Facturado: <span className="font-semibold text-slate-700">${g.invoiced.toLocaleString()}</span></span>
                            <span className="font-bold">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${g.status === "achieved" ? "bg-green-500" : g.status === "missed" ? "bg-red-400" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold">Actualizar correo</p>
                <div className="flex gap-2">
                  <Input type="email" value={userDetailEmail} onChange={(e) => setUserDetailEmail(e.target.value)} className="h-8" />
                  <Button size="sm" onClick={handleUpdateUserEmail} disabled={!userDetailEmail || userDetailEmail === selectedUserDetail?.email}>Guardar</Button>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-semibold">Restablecer contraseña</p>
                <div className="flex gap-2">
                  <Input type="password" placeholder="Nueva contraseña" value={userDetailPassword} onChange={(e) => setUserDetailPassword(e.target.value)} className="h-8" />
                  <Button size="sm" onClick={handleResetPassword} disabled={!userDetailPassword}>Guardar</Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {subTab === "workload" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Total de Leads</p>
                      <h3 className="text-2xl font-bold">{leads.length}</h3>
                    </div>
                    <div className="bg-blue-50 p-2 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Nuevos Leads</p>
                      <h3 className="text-2xl font-bold">{leads.filter((l) => l.status === "ASIGNADO").length}</h3>
                    </div>
                    <div className="bg-orange-50 p-2 rounded-lg"><Clock className="w-5 h-5 text-orange-600" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Tratos Cerrados</p>
                      <h3 className="text-2xl font-bold">{leads.filter((l) => l.status === "ENTREGADO").length}</h3>
                    </div>
                    <div className="bg-green-50 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Pipeline Total</p>
                      <h3 className="text-2xl font-bold">${leads.reduce((acc, l) => acc + l.value, 0).toLocaleString()}</h3>
                    </div>
                    <div className="bg-indigo-50 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-600" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                Supervisión de Carga de Trabajo
              </h3>

              <div className="flex flex-wrap items-center gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Buscar</p>
                  <div className="relative w-full md:w-64">
                    <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar leads o empresas..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Vendedor</p>
                  <Select value={filterSeller} onValueChange={setFilterSeller}>
                    <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Todos los Vendedores" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Vendedores</SelectItem>
                      <SelectItem value="unassigned">Sin asignar</SelectItem>
                      {users
                        .filter((u) => filterSucursal === "all" || u.sucursalId === sucursales.find((s) => s.name === filterSucursal)?.id)
                        .map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Sucursal</p>
                  <Select value={filterSucursal} onValueChange={setFilterSucursal}>
                    <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Todas las Sucursales" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las Sucursales</SelectItem>
                      {sucursales.map((s) => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Origen</p>
                  <div className="flex items-center gap-3 h-9 px-3 rounded-md border border-input bg-white">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={filterClientInitiated} onChange={(e) => setFilterClientInitiated(e.target.checked)} />
                      <span className="text-xs text-slate-700">Cliente contactó</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={filterMostrador} onChange={(e) => setFilterMostrador(e.target.checked)} />
                      <span className="text-xs text-slate-700">Mostrador</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={filterNewClient} onChange={(e) => setFilterNewClient(e.target.checked)} />
                      <span className="text-xs text-slate-700">Cliente nuevo</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <Card className="bg-white">
              <CardHeader className="pb-2">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-brand-navy">Carga por vendedor</CardTitle>
                    <CardDescription className="text-[11px]">
                      Volumen activo, valor de pipeline y conversión por persona. Conversión promedio del equipo:{" "}
                      <span className="font-semibold text-brand-navy">{workloadInsights.teamAvgConv}%</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {workloadInsights.stats.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">Sin vendedores que coincidan con los filtros actuales.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Vendedor</TableHead>
                        <TableHead className="text-[10px]">Sucursal</TableHead>
                        <TableHead className="text-[10px] text-right">Carga</TableHead>
                        <TableHead className="text-[10px] text-right">Pipeline</TableHead>
                        <TableHead className="text-[10px] text-right">Stuck &gt;1d</TableHead>
                        <TableHead className="text-[10px] text-right">Cerrados (mes)</TableHead>
                        <TableHead className="text-[10px] text-right">Conv. %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workloadInsights.stats.map((s) => {
                        const loadColor = s.activeLeads > 10 ? "text-red-600" : s.activeLeads > 5 ? "text-orange-600" : "text-emerald-600";
                        const loadBar = s.activeLeads > 10 ? "bg-red-500" : s.activeLeads > 5 ? "bg-orange-500" : "bg-emerald-500";
                        const convColor = s.convPct >= workloadInsights.teamAvgConv ? "text-emerald-700" : "text-amber-700";
                        return (
                          <TableRow key={s.user.id}>
                            <TableCell className="text-xs">
                              <div className="font-medium text-slate-900">{s.user.name}</div>
                              <div className="text-[10px] text-slate-400">{s.user.role}</div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{s.sucursalName}</TableCell>
                            <TableCell className="text-right text-xs">
                              <div className={`font-bold ${loadColor}`}>{s.activeLeads}</div>
                              <div className="h-1 w-16 ml-auto bg-slate-100 rounded-full overflow-hidden mt-0.5">
                                <div className={`h-full ${loadBar}`} style={{ width: `${Math.min((s.activeLeads / 15) * 100, 100)}%` }} />
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono">${s.pipelineValue.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-xs">
                              <span className={s.stuckCount > 0 ? "font-bold text-red-600" : "text-slate-400"}>{s.stuckCount}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-slate-700">{s.closedThisMonth}</TableCell>
                            <TableCell className={`text-right text-xs font-bold ${convColor}`}>{s.convPct}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-bold">Necesita intervención</h3>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {workloadInsights.stuckLeads.length} {workloadInsights.stuckLeads.length === 1 ? "lead" : "leads"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 -mt-1">Leads activos sin actualización en más de 24 h. Críticos rojos: sin movimiento en más de 3 días.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workloadInsights.stuckLeads.length === 0 ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-100">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-30 text-emerald-500" />
                    <p className="text-sm">Sin leads atascados en el filtro actual.</p>
                  </div>
                ) : (
                  workloadInsights.stuckLeads.map((lead) => {
                    const stuckLevel = getStuckLevel(lead.updatedAt);
                    return (
                      <Card
                        key={lead.id}
                        className={cn(
                          "bg-white hover:bg-slate-50 transition-colors cursor-pointer relative overflow-hidden",
                          stuckLevel === "critical" && "border-red-300 bg-red-50/40",
                          stuckLevel === "warning" && "border-orange-300 bg-orange-50/40"
                        )}
                        onClick={() => openStatusUpdate(lead)}
                      >
                        <div className={cn(
                          "absolute top-0 right-0 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white rounded-bl-lg",
                          stuckLevel === "critical" ? "bg-red-500" : "bg-orange-500"
                        )}>
                          {stuckLevel === "critical" ? "Retraso Crítico" : "Retrasado"}
                        </div>
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {getStatusBadge(lead.status)}
                              {lead.mostrador && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase tracking-wide">Mostrador</Badge>
                              )}
                            </div>
                            <span className="text-xs font-medium text-brand-gray">ID: {lead.id}</span>
                          </div>
                          <CardTitle className="text-base font-bold">{lead.name}</CardTitle>
                          <CardDescription className="text-xs">{lead.company}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">Valor</span>
                            <span className="text-sm font-mono font-bold text-primary">${lead.value.toLocaleString()}</span>
                          </div>
                          <div className="space-y-2 pt-2 border-t border-slate-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold">
                                  {lead.assignedTo ? users.find((u) => u.id === lead.assignedTo)?.name.charAt(0) : "?"}
                                </div>
                                <span className="text-xs text-slate-600">
                                  {lead.assignedTo ? users.find((u) => u.id === lead.assignedTo)?.name : "Sin asignar"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-50/50 p-2 rounded-lg">
                              <span className="text-[10px] font-medium text-slate-500">Tiempo sin actualizar:</span>
                              <div className="flex items-center gap-1">
                                <AlertTriangle className={cn("w-3 h-3", stuckLevel === "critical" ? "text-red-500" : "text-orange-500")} />
                                <span className={cn(
                                  "text-[10px] font-bold",
                                  stuckLevel === "critical" ? "text-red-600" : "text-orange-600"
                                )}>
                                  {getTimeStuck(lead.updatedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {subTab === "activity" && (
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" />
                    Línea de Tiempo de Actividad Global
                  </CardTitle>
                  <CardDescription>Un historial completo de todas las actualizaciones del equipo.</CardDescription>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-brand-gray ml-1">Desde</p>
                    <Input
                      type="date"
                      value={activityFrom}
                      max={activityTo || undefined}
                      onChange={(e) => setActivityFrom(e.target.value)}
                      className="h-8 text-xs w-[140px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-brand-gray ml-1">Hasta</p>
                    <Input
                      type="date"
                      value={activityTo}
                      min={activityFrom || undefined}
                      onChange={(e) => setActivityTo(e.target.value)}
                      className="h-8 text-xs w-[140px]"
                    />
                  </div>
                  {(activityFrom || activityTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setActivityFrom(""); setActivityTo(""); }}
                    >
                      Limpiar
                    </Button>
                  )}
                  <Select value={filterSeller} onValueChange={setFilterSeller}>
                    <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Filtrar por Vendedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Vendedores</SelectItem>
                      {users.map((u) => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-semibold">Vendedor</TableHead>
                      <TableHead className="font-semibold">Lead / Empresa</TableHead>
                      <TableHead className="font-semibold">Actualización</TableHead>
                      <TableHead className="font-semibold">Comentario</TableHead>
                      <TableHead className="font-semibold">Monto</TableHead>
                      <TableHead className="text-right font-semibold">Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads
                      .flatMap((l) => l.history.map((h) => ({ ...h, leadName: l.name, leadCompany: l.company, leadId: l.id, assignedTo: l.assignedTo })))
                      .filter((h) => filterSeller === "all" || h.updatedBy === filterSeller)
                      .filter((h) => {
                        // Date interval filter — inclusive on both ends.
                        // activityTo is end-of-day so the chosen day is fully included.
                        if (!activityFrom && !activityTo) return true;
                        const t = new Date(h.timestamp).getTime();
                        if (Number.isNaN(t)) return false;
                        if (activityFrom) {
                          const from = new Date(activityFrom + "T00:00:00").getTime();
                          if (t < from) return false;
                        }
                        if (activityTo) {
                          const to = new Date(activityTo + "T23:59:59.999").getTime();
                          if (t > to) return false;
                        }
                        return true;
                      })
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((update) => (
                        <TableRow key={update.id} className="group hover:bg-slate-50/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                {users.find((u) => u.id === update.updatedBy)?.name.charAt(0) || "S"}
                              </div>
                              <span className="text-sm font-medium">
                                {users.find((u) => u.id === update.updatedBy)?.name || "Sistema"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700">{update.leadName}</span>
                              <span className="text-[10px] text-slate-400">{update.leadCompany}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(update.status)}</TableCell>
                          <TableCell className="max-w-[250px]">
                            <p className="text-xs text-slate-600 line-clamp-2 italic">"{update.comment}"</p>
                          </TableCell>
                          <TableCell>
                            {update.quotedAmount !== undefined && (
                              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                C: ${update.quotedAmount.toLocaleString()}
                              </span>
                            )}
                            {update.invoicedAmount !== undefined && (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                F: ${update.invoicedAmount.toLocaleString()}
                              </span>
                            )}
                            {update.quotedAmount === undefined && update.invoicedAmount === undefined && (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-medium text-slate-600">{new Date(update.timestamp).toLocaleDateString()}</span>
                              <span className="text-[10px] text-slate-400">{new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {leads.flatMap((l) => l.history).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-400">Aún no se ha registrado actividad.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {subTab === "goals" && (
          <div className="space-y-6">
            <Card className="border-none bg-brand-navy text-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Target className="w-5 h-5 text-white/70" />
                  Establecer Meta por Sucursal
                </CardTitle>
                <CardDescription className="text-white/70">
                  Aplica una meta de ventas a todos los vendedores activos de una sucursal para el período seleccionado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-white/90">Sucursal</label>
                    <Select value={branchGoal.sucursalId} onValueChange={(val) => setBranchGoal({ ...branchGoal, sucursalId: val })}>
                      <SelectTrigger className="bg-white text-foreground border-transparent"><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
                      <SelectContent>
                        {sucursales.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.id})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-white/90">Mes</label>
                    <Select value={String(branchGoal.month)} onValueChange={(val) => setBranchGoal({ ...branchGoal, month: Number(val) })}>
                      <SelectTrigger className="bg-white text-foreground border-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map((name, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-white/90">Año</label>
                    <Select value={String(branchGoal.year)} onValueChange={(val) => setBranchGoal({ ...branchGoal, year: Number(val) })}>
                      <SelectTrigger className="bg-white text-foreground border-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-white/90">Meta ($)</label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={branchGoal.amount || ""}
                      onChange={(e) => setBranchGoal({ ...branchGoal, amount: Number(e.target.value) })}
                      className="bg-white text-foreground border-transparent placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                {branchGoal.sucursalId && (
                  <p className="text-xs text-white/60 mt-3">
                    Afectará a {users.filter((u) => u.role === "Seller" && u.sucursalId === branchGoal.sucursalId).length} vendedor(es) activo(s) en {sucursales.find((s) => s.id === branchGoal.sucursalId)?.name}.
                  </p>
                )}
                <div className="mt-4">
                  <Button onClick={handleSetBranchGoal} disabled={!branchGoal.sucursalId || !branchGoal.amount} className="gap-2">
                    <Target className="w-4 h-4" />
                    Aplicar Meta
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  Metas Actuales por Sucursal
                </CardTitle>
                <CardDescription>Meta del mes en curso para cada vendedor activo.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-semibold">Sucursal</TableHead>
                        <TableHead className="font-semibold">Vendedor</TableHead>
                        <TableHead className="font-semibold text-right">Meta Actual ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sucursales.flatMap((s) =>
                        users
                          .filter((u) => u.role === "Seller" && u.sucursalId === s.id)
                          .map((u, idx) => (
                            <TableRow key={u.id}>
                              <TableCell className="font-medium text-slate-600">{idx === 0 ? s.name : ""}</TableCell>
                              <TableCell>{u.name}</TableCell>
                              <TableCell className="text-right font-mono">
                                {u.performance.salesGoal ? `$${u.performance.salesGoal.toLocaleString()}` : <span className="text-slate-400 text-xs">Sin meta</span>}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                      {users.filter((u) => u.role === "Seller").length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center text-slate-400">No hay vendedores activos.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
