import { useEffect, useMemo, useState } from "react";
import {
  Settings, UserPlus, Users, AlertTriangle, CheckCircle2, Clock, History, Target, Building2, TrendingUp, Wallet, PackageX, Activity,
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

import { MESES, getStuckLevel, getTimeStuck, getLeadLastActivity, facturadoMonth } from "../../lib/helpers";
import { useAppData } from "../../state/AppDataContext";
import { apiFetch } from "../../lib/api";
import type { Lead, LeadStatus, SalesGoal, User } from "../../types";
import { useWorkloadInsights } from "./useWorkloadInsights";
import { RentabilidadReport } from "./RentabilidadReport";
import { getStatusBadge } from "../leads/getStatusBadge";

export interface AdminTabProps {
  openStatusUpdate: (lead: Lead) => void;
  // Sub-tab selection is lifted to App so the lateral "Panel Admin" dropdown and
  // the in-place sub-tab header below stay in sync.
  subTab: string;
  setSubTab: (v: string) => void;
}

// Pesos formatter for the workload KPI cards (ventas / utilidad), whole pesos.
const mxn0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

// Actividad Global defaults to a recent window so the first render stays light —
// the lead history ships with /api/leads, and showing every update at once lags.
const ACTIVITY_DEFAULT_DAYS = 5;
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA"); // 'YYYY-MM-DD' local
};

// Shape of GET /api/performance/rentabilidad?anio=YYYY (admin). Each cell is net
// of devoluciones/rechazos y bonificaciones — `importe` is "ventas" (importe
// neto), `utilidad` is utilidad bruta. Both the monthly and yearly KPI cards are
// derived from a single year fetch.
type RentCelda = { importe: number; costo: number; utilidad: number; rentabilidad: number };
type RentVendedor = { id: string; nombre: string; meses: RentCelda[]; total: RentCelda };
type RentResp = { anio: string; vendedores: RentVendedor[]; totalesMes: RentCelda[]; total: RentCelda };
const EMPTY_VENTA = { importe: 0, utilidad: 0 };

const NEW_USER_BLANK = { name: "", email: "", role: "Seller" as "Admin" | "Seller" | "Compras", salesGoal: 50000, utilidadGoal: 0, sucursal: "" };
const STAGE_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "ASIGNADO", label: "Asignado" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "NEGOCIACION", label: "Negociación" },
  { value: "COTIZADO", label: "Cotizado" },
  { value: "FACTURADO", label: "Facturado" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "RECHAZADO", label: "Rechazado" },
];
const BRANCH_GOAL_BLANK = () => ({
  sucursalId: "",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  amount: 0,
  utilidadAmount: 0,
});

export function AdminTab({ openStatusUpdate, subTab, setSubTab }: AdminTabProps) {
  const { leads, users, sucursales, segmentos, faltantes, refetchAll } = useAppData();

  // Filters shared by Users / Workload / Activity
  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [filterSucursal, setFilterSucursal] = useState<string>("all");
  const [filterSegmento, setFilterSegmento] = useState<string>("all");

  // Workload period selector — drives the KPI cards (new leads, ventas/utilidad,
  // cerrados) and the "cerrados del mes" column. Defaults to the current month.
  const now = new Date();
  const [wlYear, setWlYear] = useState<number>(now.getFullYear());
  const [wlMonth, setWlMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const wlYm = `${wlYear}-${String(wlMonth).padStart(2, "0")}`;
  const yearOpts = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // Actividad Global date interval (YYYY-MM-DD strings from <input type="date">).
  // Defaults to the last ACTIVITY_DEFAULT_DAYS so the timeline loads a light,
  // recent window instead of every update ever recorded.
  const [activityFrom, setActivityFrom] = useState<string>(() => daysAgoStr(ACTIVITY_DEFAULT_DAYS));
  const [activityTo, setActivityTo] = useState<string>("");
  // The timeline table below spans the date filter (5 días por defecto), but the
  // KPI cards summarize hoy only until the user actively engages the date filter.
  // False on initial load and after "Limpiar" ⇒ cards collapse to the current day.
  const [dateFilterTouched, setDateFilterTouched] = useState<boolean>(false);
  // Actividad Global pipeline-stage filter — empty set = show all stages
  const [filterStages, setFilterStages] = useState<Set<LeadStatus>>(new Set());

  const toggleStage = (stage: LeadStatus) => {
    setFilterStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      return next;
    });
  };

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
    ym: wlYm,
  });

  // Ventas (importe neto) y utilidad bruta del año seleccionado, de la mirror
  // materializada. Una sola llamada por año alimenta las tarjetas de mes y año.
  const [rentResp, setRentResp] = useState<RentResp | null>(null);
  useEffect(() => {
    if (subTab !== "workload") return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch(`/api/performance/rentabilidad?anio=${wlYear}`);
        const json = await r.json();
        if (!cancelled && r.ok) setRentResp(json);
      } catch {
        if (!cancelled) setRentResp(null);
      }
    })();
    return () => { cancelled = true; };
  }, [subTab, wlYear]);

  // Resolve the sucursal name-filter to its id once (vendedor rows carry ids).
  const sucursalIdFilter: string | null =
    filterSucursal === "all" ? null : sucursales.find((s) => s.name === filterSucursal)?.id || null;

  // A lead passes the vendedor + sucursal scope used by the KPI cards.
  const leadInScope = (l: Lead) => {
    if (filterSeller === "unassigned") { if (l.assignedTo) return false; }
    else if (filterSeller !== "all") { if (l.assignedTo !== filterSeller) return false; }
    if (sucursalIdFilter) {
      const owner = users.find((u) => u.id === l.assignedTo);
      if (!owner || owner.sucursalId !== sucursalIdFilter) return false;
    }
    return true;
  };

  // KPI card numbers from CRM leads, scoped by vendedor + sucursal + period.
  const newLeadsThisMonth = leads.filter(
    (l) => leadInScope(l) && String(l.createdAt).slice(0, 7) === wlYm
  ).length;
  const closedThisMonth = leads.filter(
    (l) => leadInScope(l) && (l.status === "FACTURADO" || l.status === "ENTREGADO") && facturadoMonth(l) === wlYm
  ).length;

  // Ventas/utilidad del mes y del año, respetando vendedor + sucursal. Importe
  // neto = "ventas"; utilidad bruta = "utilidad". "Sin asignar" no tiene ventas.
  const ventas = useMemo(() => {
    if (!rentResp || filterSeller === "unassigned") return { mes: EMPTY_VENTA, anio: EMPTY_VENTA };
    const m = wlMonth - 1;
    const pick = (c?: RentCelda) => ({ importe: c?.importe || 0, utilidad: c?.utilidad || 0 });
    const sum = (vs: RentVendedor[], get: (v: RentVendedor) => RentCelda) =>
      vs.reduce((a, v) => { const c = get(v); return { importe: a.importe + c.importe, utilidad: a.utilidad + c.utilidad }; }, { ...EMPTY_VENTA });

    if (filterSeller !== "all") {
      const v = rentResp.vendedores.find((x) => x.id === filterSeller);
      return { mes: pick(v?.meses[m]), anio: pick(v?.total) };
    }
    if (sucursalIdFilter) {
      const ids = new Set(users.filter((u) => u.sucursalId === sucursalIdFilter).map((u) => u.id));
      const vs = rentResp.vendedores.filter((v) => ids.has(v.id));
      return { mes: sum(vs, (v) => v.meses[m]), anio: sum(vs, (v) => v.total) };
    }
    return { mes: pick(rentResp.totalesMes[m]), anio: pick(rentResp.total) };
  }, [rentResp, wlMonth, filterSeller, sucursalIdFilter, users]);

  // ── Actividad Global dashboard (día) ──────────────────────────────────────
  // Effective day/range for the KPI cards. Until the user actively engages the
  // date filter (dateFilterTouched), the cards show hoy only — even though the
  // timeline table below spans the default 5-day window. Once touched: From-only
  // ⇒ that single day, From+To ⇒ the range, mirroring the table.
  const todayStr = new Date().toLocaleDateString("en-CA"); // 'YYYY-MM-DD' local
  const dayFrom = dateFilterTouched ? (activityFrom || todayStr) : todayStr;
  const dayTo = dateFilterTouched ? (activityTo || todayStr) : todayStr;
  const isSingleDay = dayFrom === dayTo;

  // True if an ISO timestamp falls within [dayFrom 00:00, dayTo 23:59:59.999].
  const inDayRange = (iso: string) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return (
      t >= new Date(dayFrom + "T00:00:00").getTime() &&
      t <= new Date(dayTo + "T23:59:59.999").getTime()
    );
  };

  // Ventas (importe neto) y utilidad bruta del día/rango, de la mirror diaria.
  const [dailyRent, setDailyRent] = useState(EMPTY_VENTA);
  useEffect(() => {
    if (subTab !== "activity") return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ desde: dayFrom, hasta: dayTo });
        if (filterSeller !== "all") params.set("vendedor", filterSeller);
        const r = await apiFetch(`/api/performance/rentabilidad/diario?${params.toString()}`);
        const json = await r.json();
        if (!cancelled && r.ok) setDailyRent({ importe: json.total?.importe || 0, utilidad: json.total?.utilidad || 0 });
        else if (!cancelled) setDailyRent(EMPTY_VENTA);
      } catch {
        if (!cancelled) setDailyRent(EMPTY_VENTA);
      }
    })();
    return () => { cancelled = true; };
  }, [subTab, dayFrom, dayTo, filterSeller]);

  // Contador de actualizaciones del día/rango, por etapa — del historial de leads.
  const updateStats = useMemo(() => {
    const counts = Object.fromEntries(STAGE_OPTIONS.map((s) => [s.value, 0])) as Record<LeadStatus, number>;
    let total = 0;
    for (const l of leads) {
      for (const h of l.history) {
        if (filterSeller !== "all" && h.updatedBy !== filterSeller) continue;
        if (!inDayRange(h.timestamp)) continue;
        if (counts[h.status] !== undefined) counts[h.status]++;
        total++;
      }
    }
    return { counts, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, filterSeller, dayFrom, dayTo]);

  // Contador de productos marcados como faltante ese día/rango (cuántos, no monto).
  const faltanteCount = useMemo(
    () =>
      faltantes.filter((f) => {
        if (filterSeller !== "all" && f.vendedorId !== filterSeller) return false;
        return inDayRange(f.createdAt);
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [faltantes, filterSeller, dayFrom, dayTo]
  );

  const fetchGoalsTimeline = async (userId: string) => {
    setGoalsLoading(true);
    try {
      const res = await apiFetch(`/api/users/${userId}/goals`);
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
      const res = await apiFetch(`/api/users/${selectedUserDetail.id}/email`, {
        method: "POST",
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
      const res = await apiFetch(`/api/users/${selectedUserDetail.id}/reset-password`, {
        method: "POST",
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
      const res = await apiFetch(`/api/users/${userId}/role`, {
        method: "POST",
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
      const res = await apiFetch(`/api/users/${userId}/goal`, {
        method: "POST",
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

  const handleUpdateUtilidadGoal = async (userId: string, metaUtilidad: number) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/goal`, {
        method: "POST",
        body: JSON.stringify({ metaUtilidad }),
      });
      if (res.ok) {
        toast.success("Meta de utilidad actualizada");
        refetchAll();
      }
    } catch {
      toast.error("Error al actualizar meta de utilidad");
    }
  };

  const handleSetBranchGoal = async () => {
    if (!branchGoal.sucursalId || (!branchGoal.amount && !branchGoal.utilidadAmount)) return;
    try {
      // Send only the fields the admin actually filled, so leaving one blank
      // doesn't zero out the existing goal (the API preserves the untouched one).
      const body: Record<string, number> = { year: branchGoal.year, month: branchGoal.month };
      if (branchGoal.amount) body.goal = branchGoal.amount;
      if (branchGoal.utilidadAmount) body.metaUtilidad = branchGoal.utilidadAmount;
      const res = await apiFetch(`/api/sucursales/${branchGoal.sucursalId}/goal`, {
        method: "POST",
        body: JSON.stringify(body),
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
      const res = await apiFetch("/api/users", {
        method: "POST",
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
            <TabsTrigger value="rentabilidad" className="text-xs px-4">Rentabilidad</TabsTrigger>
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Meta de Ventas ($)</label>
                          <Input type="number" value={newUser.salesGoal || ""} onChange={(e) => setNewUser({ ...newUser, salesGoal: Number(e.target.value) })} />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium">Meta de Utilidad ($)</label>
                          <Input type="number" value={newUser.utilidadGoal || ""} onChange={(e) => setNewUser({ ...newUser, utilidadGoal: Number(e.target.value) })} />
                        </div>
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
                      <TableHead className="font-semibold">Meta de Utilidad ($)</TableHead>
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
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-28 h-8"
                                defaultValue={user.performance.utilidadGoal}
                                onBlur={(e) => {
                                  const newVal = Number(e.target.value);
                                  if (newVal !== user.performance.utilidadGoal) handleUpdateUtilidadGoal(user.id, newVal);
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
                      const uPct = g.metaUtilidad > 0 ? Math.min(100, Math.round((g.utilidad / g.metaUtilidad) * 100)) : 0;
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
                            <span>Meta venta: <span className="font-semibold text-slate-700">${g.meta.toLocaleString()}</span></span>
                            <span>Facturado: <span className="font-semibold text-slate-700">${g.invoiced.toLocaleString()}</span></span>
                            <span className="font-bold">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${g.status === "achieved" ? "bg-green-500" : g.status === "missed" ? "bg-red-400" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t">
                            <span>Meta util.: <span className="font-semibold text-slate-700">${g.metaUtilidad.toLocaleString()}</span></span>
                            <span>Utilidad: <span className="font-semibold text-slate-700">${g.utilidad.toLocaleString()}</span></span>
                            <span className="font-bold">{uPct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${g.utilidadStatus === "achieved" ? "bg-emerald-500" : g.utilidadStatus === "missed" ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${uPct}%` }} />
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
              {/* Nuevos leads del periodo seleccionado */}
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Nuevos Leads · {MESES[wlMonth - 1]}</p>
                      <h3 className="text-2xl font-bold">{newLeadsThisMonth}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Creados en {MESES[wlMonth - 1]} {wlYear}</p>
                    </div>
                    <div className="bg-blue-50 p-2 rounded-lg"><UserPlus className="w-5 h-5 text-blue-600" /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Ventas y utilidad del mes */}
              <Card className="bg-white">
                <CardContent className="px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 mb-1">Mes</span>
                      <p className="text-sm font-medium text-slate-500">Ventas · {MESES[wlMonth - 1]}</p>
                      <h3 className="text-2xl font-bold">{mxn0.format(ventas.mes.importe)}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Utilidad <span className={ventas.mes.utilidad < 0 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold"}>{mxn0.format(ventas.mes.utilidad)}</span>
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Ventas y utilidad del año */}
              <Card className="bg-brand-navy text-white border-none">
                <CardContent className="px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="inline-block text-[10px] font-bold tracking-wider uppercase text-white bg-white/15 border border-white/25 rounded px-1.5 py-0.5 mb-1">Año</span>
                      <p className="text-sm font-medium text-white/70">Ventas · {wlYear}</p>
                      <h3 className="text-2xl font-bold">{mxn0.format(ventas.anio.importe)}</h3>
                      <p className="text-[11px] text-white/60 mt-0.5">
                        Utilidad <span className="font-semibold text-white">{mxn0.format(ventas.anio.utilidad)}</span>
                      </p>
                    </div>
                    <div className="bg-white/10 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-white" /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Tratos cerrados del mes (facturado + entregado) */}
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Cerrados · {MESES[wlMonth - 1]}</p>
                      <h3 className="text-2xl font-bold">{closedThisMonth}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Facturado + Entregado</p>
                    </div>
                    <div className="bg-green-50 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
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
                  <p className="text-xs font-medium text-brand-gray ml-1">Periodo</p>
                  <div className="flex gap-2">
                    <Select value={String(wlMonth)} onValueChange={(v) => setWlMonth(Number(v))}>
                      <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map((m, i) => (<SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Select value={String(wlYear)} onValueChange={(v) => setWlYear(Number(v))}>
                      <SelectTrigger className="w-[90px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {yearOpts.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                      </SelectContent>
                    </Select>
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
              <p className="text-xs text-slate-500 -mt-1">Leads activos sin actualización en más de 3 días. Críticos rojos: sin movimiento en más de 7 días.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workloadInsights.stuckLeads.length === 0 ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-100">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-30 text-emerald-500" />
                    <p className="text-sm">Sin leads atascados en el filtro actual.</p>
                  </div>
                ) : (
                  workloadInsights.stuckLeads.map((lead) => {
                    const lastActivity = getLeadLastActivity(lead);
                    const stuckLevel = getStuckLevel(lastActivity);
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
                                <span>{new Date(lastActivity).toLocaleDateString()}</span>
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
                                  {getTimeStuck(lastActivity)}
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
          <div className="space-y-6">
          {/* Resumen del día / periodo seleccionado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ventas diarias */}
            <Card className="bg-brand-navy text-white border-none">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-white/70">
                      {isSingleDay ? "Ventas del día" : "Ventas del periodo"}
                    </p>
                    <h3 className="text-2xl font-bold mt-0.5">{mxn0.format(dailyRent.importe)}</h3>
                    <p className="text-[11px] text-white/60 mt-1">
                      Utilidad <span className="font-semibold text-white">{mxn0.format(dailyRent.utilidad)}</span>
                    </p>
                    <p className="text-[10px] text-white/50 mt-1">
                      {isSingleDay
                        ? new Date(dayFrom + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
                        : `${new Date(dayFrom + "T00:00:00").toLocaleDateString("es-MX")} – ${new Date(dayTo + "T00:00:00").toLocaleDateString("es-MX")}`}
                      {filterSeller !== "all" && ` · ${users.find((u) => u.id === filterSeller)?.name || ""}`}
                    </p>
                  </div>
                  <div className="bg-white/10 p-2 rounded-lg"><Wallet className="w-5 h-5 text-white" /></div>
                </div>
              </CardContent>
            </Card>

            {/* Actualizaciones del día (total) */}
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Actualizaciones</p>
                    <h3 className="text-2xl font-bold mt-0.5">{updateStats.total}</h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isSingleDay ? "Registradas en el día" : "Registradas en el periodo"}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg"><Activity className="w-5 h-5 text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>

            {/* Productos marcados como faltante */}
            <Card className="bg-white">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Productos faltantes</p>
                    <h3 className="text-2xl font-bold mt-0.5">{faltanteCount}</h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isSingleDay ? "Marcados en el día" : "Marcados en el periodo"}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-2 rounded-lg"><PackageX className="w-5 h-5 text-amber-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actualizaciones por etapa — clic = filtro rápido de la línea de tiempo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {STAGE_OPTIONS.map((opt) => {
              const n = updateStats.counts[opt.value] || 0;
              const active = filterStages.has(opt.value);
              return (
                <Card
                  key={opt.value}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleStage(opt.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleStage(opt.value); } }}
                  title={active ? `Quitar filtro: ${opt.label}` : `Filtrar la línea de tiempo por: ${opt.label}`}
                  className={cn(
                    "bg-white cursor-pointer transition-all select-none hover:border-slate-300 hover:shadow-sm",
                    active && "ring-2 ring-primary border-primary shadow-sm",
                    n === 0 && !active && "opacity-60"
                  )}
                >
                  <CardContent className="py-3 px-3 text-center">
                    <div className="mb-1 flex justify-center">{getStatusBadge(opt.value)}</div>
                    <h4 className="text-xl font-bold leading-none">{n}</h4>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filterStages.size > 0 && (
            <p className="-mt-3 text-[11px] text-slate-400">
              Filtrando por {filterStages.size} etapa{filterStages.size > 1 ? "s" : ""} · clic de nuevo para quitar
            </p>
          )}

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
                      onChange={(e) => { setDateFilterTouched(true); setActivityFrom(e.target.value); }}
                      className="h-8 text-xs w-[140px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-brand-gray ml-1">Hasta</p>
                    <Input
                      type="date"
                      value={activityTo}
                      min={activityFrom || undefined}
                      onChange={(e) => { setDateFilterTouched(true); setActivityTo(e.target.value); }}
                      className="h-8 text-xs w-[140px]"
                    />
                  </div>
                  {(activityFrom || activityTo || filterStages.size > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => { setActivityFrom(daysAgoStr(ACTIVITY_DEFAULT_DAYS)); setActivityTo(""); setFilterStages(new Set()); setDateFilterTouched(false); }}
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
              <div className="mt-3 space-y-1">
                <p className="text-[10px] font-medium text-brand-gray ml-1">Etapas del pipeline</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 rounded-md border border-input bg-white">
                  {STAGE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={filterStages.has(opt.value)}
                        onChange={() => toggleStage(opt.value)}
                      />
                      <span className="text-xs text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                  {filterStages.size === 0 && (
                    <span className="text-[10px] text-slate-400 italic ml-auto">Sin filtro: mostrando todas las etapas</span>
                  )}
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
                      .filter((h) => filterStages.size === 0 || filterStages.has(h.status))
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
                        <TableRow
                          key={update.id}
                          className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => {
                            const lead = leads.find((l) => l.id === update.leadId);
                            if (lead) openStatusUpdate(lead);
                          }}
                          title="Ver historial y agregar comentario"
                        >
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
          </div>
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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
                    <label className="text-sm font-medium text-white/90">Meta venta ($)</label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={branchGoal.amount || ""}
                      onChange={(e) => setBranchGoal({ ...branchGoal, amount: Number(e.target.value) })}
                      className="bg-white text-foreground border-transparent placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-white/90">Meta utilidad ($)</label>
                    <Input
                      type="number"
                      placeholder="15000"
                      value={branchGoal.utilidadAmount || ""}
                      onChange={(e) => setBranchGoal({ ...branchGoal, utilidadAmount: Number(e.target.value) })}
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
                  <Button onClick={handleSetBranchGoal} disabled={!branchGoal.sucursalId || (!branchGoal.amount && !branchGoal.utilidadAmount)} className="gap-2">
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
                        <TableHead className="font-semibold text-right">Meta Venta ($)</TableHead>
                        <TableHead className="font-semibold text-right">Meta Utilidad ($)</TableHead>
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
                              <TableCell className="text-right font-mono">
                                {u.performance.utilidadGoal ? `$${u.performance.utilidadGoal.toLocaleString()}` : <span className="text-slate-400 text-xs">Sin meta</span>}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                      {users.filter((u) => u.role === "Seller").length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-slate-400">No hay vendedores activos.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {subTab === "rentabilidad" && <RentabilidadReport />}
      </div>
    </>
  );
}
