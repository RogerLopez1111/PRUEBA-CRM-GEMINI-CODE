import { useState } from "react";
import { Mail, Plus, Search, Clock } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { MESES } from "../../lib/helpers";
import { useAppData } from "../../state/AppDataContext";
import type { Lead, Product, PedidoExtraordinario, PedidoExtraordinarioEstado } from "../../types";
import { usePedidosRollup } from "./usePedidosRollup";

const estadoStyles: Record<string, string> = {
  solicitado: "bg-amber-50 text-amber-700 border-amber-200",
  aprobado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pedido: "bg-sky-50 text-sky-700 border-sky-200",
  rechazado: "bg-red-50 text-red-700 border-red-200",
  cancelado: "bg-slate-100 text-slate-600 border-slate-200",
};

const estadoLabel: Record<string, string> = {
  solicitado: "Solicitado",
  aprobado: "Aprobado",
  pedido: "Pedido",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

type NewPedidoForm = {
  leadId: string;
  leadLabel: string;
  productoId: string;
  productoDescripcion: string;
  cantidad: number;
  valorEstimado: number;
  compromisoDias: number;
  justificacion: string;
};

const emptyForm: NewPedidoForm = {
  leadId: "", leadLabel: "",
  productoId: "", productoDescripcion: "",
  cantidad: 0, valorEstimado: 0,
  compromisoDias: 10, justificacion: "",
};

export function PedidosTab() {
  const { leads, sucursales, productos, currentUser, refetchPedidos } = useAppData();

  // Form / dialog state — local to this tab now that App.tsx is being split.
  const [isPedidoOpen, setIsPedidoOpen] = useState(false);
  const [isPedidoLeadSearchOpen, setIsPedidoLeadSearchOpen] = useState(false);
  const [pedidoLeadSearch, setPedidoLeadSearch] = useState("");
  const [editingPedidoId, setEditingPedidoId] = useState<string | null>(null);
  const [newPedido, setNewPedido] = useState<NewPedidoForm>(emptyForm);
  const [isProductoSearchOpen, setIsProductoSearchOpen] = useState(false);
  const [productoSearch, setProductoSearch] = useState("");
  const [resolvePedido, setResolvePedido] = useState<{ id: string; action: "aprobar" | "rechazar" | "pedido"; comment: string } | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);

  // Filter state
  const [filterSucursal, setFilterSucursal] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<"all" | PedidoExtraordinarioEstado>("all");

  const { monthOptions, filtered: filteredPedidos, rollup: pedidosRollup } = usePedidosRollup({
    sucursal: filterSucursal,
    month: filterMonth,
    estado: filterEstado,
  });

  if (!currentUser) return null;

  const resetPedidoForm = () => {
    setEditingPedidoId(null);
    setNewPedido(emptyForm);
    setProductoSearch("");
    setPedidoLeadSearch("");
  };

  const startEditPedido = (p: PedidoExtraordinario) => {
    setEditingPedidoId(p.id);
    setNewPedido({
      leadId: p.leadId,
      leadLabel: p.leadCompany || p.leadId,
      productoId: p.productoId || "",
      productoDescripcion: p.productoDescripcion,
      cantidad: p.cantidad,
      valorEstimado: p.valorEstimado,
      compromisoDias: p.compromisoDias,
      justificacion: p.justificacion || "",
    });
    setProductoSearch("");
    setPedidoLeadSearch("");
    setIsPedidoOpen(true);
  };

  const handleSubmitPedido = async () => {
    if (!currentUser) return;
    if (!newPedido.leadId) { toast.error("Selecciona un lead activo"); return; }
    if (!newPedido.productoDescripcion.trim()) { toast.error("Selecciona un producto o escribe una descripción"); return; }
    if (!newPedido.cantidad || newPedido.cantidad <= 0) { toast.error("Captura una cantidad válida"); return; }
    if (!newPedido.valorEstimado || newPedido.valorEstimado <= 0) { toast.error("Captura el valor estimado de la venta"); return; }

    const isEdit = !!editingPedidoId;
    try {
      const res = await fetch(
        isEdit ? `/api/pedidos-extraordinarios/${editingPedidoId}` : "/api/pedidos-extraordinarios",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  actorId: currentUser.id,
                  actorRole: currentUser.role,
                  productoId: newPedido.productoId || null,
                  productoDescripcion: newPedido.productoDescripcion,
                  cantidad: newPedido.cantidad,
                  valorEstimado: newPedido.valorEstimado,
                  compromisoDias: newPedido.compromisoDias,
                  justificacion: newPedido.justificacion,
                }
              : {
                  userId: currentUser.id,
                  leadId: newPedido.leadId,
                  productoId: newPedido.productoId || undefined,
                  productoDescripcion: newPedido.productoDescripcion,
                  cantidad: newPedido.cantidad,
                  valorEstimado: newPedido.valorEstimado,
                  compromisoDias: newPedido.compromisoDias,
                  justificacion: newPedido.justificacion,
                }
          ),
        }
      );
      if (res.ok) {
        toast.success(isEdit ? "Pedido actualizado" : "Pedido extraordinario solicitado");
        setIsPedidoOpen(false);
        resetPedidoForm();
        await refetchPedidos();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || (isEdit ? "Error al actualizar pedido" : "Error al solicitar pedido"));
      }
    } catch {
      toast.error(isEdit ? "Error al actualizar pedido" : "Error al solicitar pedido");
    }
  };

  const cancelPedido = async (p: PedidoExtraordinario) => {
    if (!currentUser) return;
    if (!window.confirm("¿Cancelar este pedido extraordinario?")) return;
    try {
      const res = await fetch(`/api/pedidos-extraordinarios/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: currentUser.id, actorRole: currentUser.role, estado: "cancelado" }),
      });
      if (res.ok) {
        toast.success("Pedido cancelado");
        await refetchPedidos();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al cancelar");
      }
    } catch {
      toast.error("Error al cancelar");
    }
  };

  const submitResolvePedido = async () => {
    if (!currentUser || !resolvePedido) return;
    const estado =
      resolvePedido.action === "aprobar" ? "aprobado" :
      resolvePedido.action === "rechazar" ? "rechazado" :
      "pedido";
    try {
      const res = await fetch(`/api/pedidos-extraordinarios/${resolvePedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorId: currentUser.id,
          actorRole: currentUser.role,
          estado,
          resolucionComentario: resolvePedido.comment,
        }),
      });
      if (res.ok) {
        toast.success(estado === "aprobado" ? "Pedido aprobado" : estado === "rechazado" ? "Pedido rechazado" : "Marcado como pedido");
        setResolvePedido(null);
        await refetchPedidos();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al resolver");
      }
    } catch {
      toast.error("Error al resolver");
    }
  };

  const handleSendDigestNow = async () => {
    if (currentUser.role !== "Admin") return;
    if (!window.confirm("¿Enviar ahora el resumen de pedidos extraordinarios a los usuarios de Compras?")) return;
    setSendingDigest(true);
    try {
      const res = await fetch("/api/pedidos-extraordinarios/send-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: currentUser.id, actorRole: currentUser.role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al enviar el resumen");
        return;
      }
      const data = await res.json();
      const sent = data.sentTo?.length || 0;
      const failed = data.failedTo?.length || 0;
      const total = data.recipientCount || 0;
      if (total === 0) {
        toast.warning("No hay usuarios de Compras con email registrado.");
      } else if (failed === 0) {
        toast.success(`Resumen enviado a ${sent} usuario(s) de Compras.`);
      } else {
        toast.warning(`Resumen enviado a ${sent} de ${total} (${failed} fallaron).`);
      }
    } catch {
      toast.error("Error al enviar el resumen");
    } finally {
      setSendingDigest(false);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pedidos Extraordinarios</h2>
          <p className="text-slate-500">Solicita la compra de un producto fuera de las ventanas regulares cuando el cliente está dispuesto a esperar (máx. 10 días).</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser.role === "Admin" && (
            <Button variant="outline" className="gap-2" onClick={handleSendDigestNow} disabled={sendingDigest}>
              <Mail className="w-4 h-4" />
              {sendingDigest ? "Enviando…" : "Enviar resumen ahora"}
            </Button>
          )}
          {currentUser.role !== "Compras" && (
            <Dialog open={isPedidoOpen} onOpenChange={(open) => { setIsPedidoOpen(open); if (!open) resetPedidoForm(); }}>
              <DialogTrigger nativeButton={true} render={<Button className="gap-2" />}>
                <Plus className="w-4 h-4" />
                Solicitar Pedido
              </DialogTrigger>
              <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                  <DialogTitle>{editingPedidoId ? "Editar Pedido Extraordinario" : "Solicitar Pedido Extraordinario"}</DialogTitle>
                  <DialogDescription>
                    Antes de pedir: confirma que la venta justifica un pedido fuera de ventana y que el cliente está dispuesto a esperar al menos 10 días para recibir el producto.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Lead activo</label>
                    <Popover open={isPedidoLeadSearchOpen} onOpenChange={setIsPedidoLeadSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal" disabled={!!editingPedidoId}>
                          {newPedido.leadId
                            ? `${newPedido.leadId} — ${newPedido.leadLabel}`
                            : "Selecciona un lead activo"}
                          <Search className="w-3 h-3 ml-2 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[420px]" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Buscar por empresa, contacto o id de lead..."
                            value={pedidoLeadSearch}
                            onValueChange={setPedidoLeadSearch}
                          />
                          <CommandList>
                            {(() => {
                              const rawQ = pedidoLeadSearch.trim().toLowerCase();
                              const isSeller = currentUser?.role === "Seller";
                              const candidates = leads.filter((l: Lead) => {
                                if (!["ASIGNADO", "CONTACTADO", "NEGOCIACION", "COTIZADO"].includes(l.status)) return false;
                                if (isSeller && l.assignedTo !== currentUser?.id) return false;
                                return true;
                              });
                              const norm = (s: string) => s.toLowerCase();
                              const matches = candidates.filter((l: Lead) =>
                                !rawQ || norm(l.company).includes(rawQ) || norm(l.name).includes(rawQ) || l.id.includes(rawQ)
                              ).slice(0, 50);
                              if (matches.length === 0) return <CommandEmpty>Sin leads activos.</CommandEmpty>;
                              return (
                                <CommandGroup>
                                  {matches.map((l: Lead) => (
                                    <CommandItem
                                      key={l.id}
                                      value={l.id}
                                      onSelect={() => {
                                        setNewPedido({ ...newPedido, leadId: l.id, leadLabel: l.company || l.name });
                                        setIsPedidoLeadSearchOpen(false);
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{l.company || l.name}</span>
                                        <span className="text-[10px] text-slate-500">{l.id} · {l.status} · ${l.value.toLocaleString()}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              );
                            })()}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {editingPedidoId && (
                      <p className="text-[10px] text-slate-500">El lead vinculado no se puede cambiar al editar.</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Producto</label>
                    <p className="text-[10px] text-slate-500 -mt-1">
                      Solo un producto por solicitud. Usa <Search className="inline w-3 h-3 -mt-0.5" /> para buscarlo en el catálogo, o escribe la descripción si no existe.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Descripción del producto"
                        value={newPedido.productoDescripcion}
                        onChange={(e) => setNewPedido({ ...newPedido, productoDescripcion: e.target.value, productoId: "" })}
                        className="flex-1"
                      />
                      <Popover open={isProductoSearchOpen} onOpenChange={setIsProductoSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="shrink-0">
                            <Search className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[340px]" align="end">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Buscar por descripción, clave, número de parte..."
                              value={productoSearch}
                              onValueChange={setProductoSearch}
                            />
                            <CommandList>
                              {(() => {
                                const rawQ = productoSearch.trim().toLowerCase();
                                if (!rawQ) {
                                  return (
                                    <div className="py-6 text-center text-xs text-slate-500">
                                      Escribe para buscar entre {productos.length.toLocaleString()} productos activos
                                    </div>
                                  );
                                }
                                const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
                                const q = squash(rawQ);
                                const matches: Product[] = [];
                                for (const p of productos) {
                                  if (
                                    squash(p.descripcion).includes(q) ||
                                    squash(p.descripcionCorta || '').includes(q) ||
                                    squash(p.claveCorta || '').includes(q) ||
                                    squash(p.numeroParte || '').includes(q) ||
                                    (p.barras || '').includes(rawQ) ||
                                    p.id.includes(rawQ)
                                  ) {
                                    matches.push(p);
                                    if (matches.length >= 50) break;
                                  }
                                }
                                if (matches.length === 0) return <CommandEmpty>Sin resultados.</CommandEmpty>;
                                return (
                                  <CommandGroup>
                                    {matches.map(p => (
                                      <CommandItem
                                        key={p.id}
                                        value={p.id}
                                        onSelect={() => {
                                          setNewPedido({ ...newPedido, productoId: p.id, productoDescripcion: p.descripcion });
                                          setIsProductoSearchOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium">{p.descripcion}</span>
                                          <span className="text-[10px] text-slate-500">
                                            {p.claveCorta || p.numeroParte || p.id}
                                            {p.unidadVenta ? ` · ${p.unidadVenta}` : ''}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                );
                              })()}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {newPedido.productoId && (
                      <p className="text-[10px] text-emerald-700">Vinculado a producto ERP {newPedido.productoId}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Cantidad</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newPedido.cantidad || ""}
                      onChange={(e) => setNewPedido({ ...newPedido, cantidad: Number(e.target.value) })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Valor estimado de la venta ($)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={newPedido.valorEstimado || ""}
                      onChange={(e) => setNewPedido({ ...newPedido, valorEstimado: Number(e.target.value) })}
                    />
                    <p className="text-[10px] text-amber-700">Reflexiona: ¿el monto justifica un pedido fuera de ventana? Si no, considera no levantarlo.</p>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Justificación</label>
                    <Textarea
                      placeholder="Por qué vale la pena ordenar fuera de ventana, condiciones del cliente, etc."
                      value={newPedido.justificacion}
                      onChange={(e) => setNewPedido({ ...newPedido, justificacion: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPedidoOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSubmitPedido}>{editingPedidoId ? "Guardar cambios" : "Solicitar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-brand-gray ml-1">Sucursal</p>
          <Select value={filterSucursal} onValueChange={setFilterSucursal}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Todas las Sucursales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Sucursales</SelectItem>
              {sucursales.map(s => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-brand-gray ml-1">Mes</p>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Todos los meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {monthOptions.map(ym => {
                const [y, m] = ym.split("-");
                const label = `${MESES[Number(m) - 1]} ${y}`;
                return <SelectItem key={ym} value={ym}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-brand-gray ml-1">Estado</p>
          <Select value={filterEstado} onValueChange={(v) => setFilterEstado(v as "all" | PedidoExtraordinarioEstado)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="solicitado">Solicitados</SelectItem>
              <SelectItem value="aprobado">Aprobados</SelectItem>
              <SelectItem value="pedido">Pedidos</SelectItem>
              <SelectItem value="rechazado">Rechazados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(currentUser.role === "Admin" || currentUser.role === "Compras") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-white">
            <CardHeader className="pb-1 pt-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">Pendientes de aprobar</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-700">{pedidosRollup.pendientes}</span>
                <span className="text-[10px] text-slate-500">solicitudes</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">${pedidosRollup.valorPendienteTotal.toLocaleString()} en juego</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-1 pt-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">Valor aprobado este mes</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-brand-navy">${pedidosRollup.valorAprobadoMes.toLocaleString()}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Ventas potenciales rescatadas con pedidos extraordinarios.</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-1 pt-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">% de aprobación</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-brand-navy">{pedidosRollup.aprobacionPct}%</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{pedidosRollup.aprobados} aprobados · {pedidosRollup.rechazados} rechazados</p>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-1 pt-3">
              <CardDescription className="text-[10px] uppercase tracking-wide">Tiempo promedio de resolución</CardDescription>
            </CardHeader>
            <CardContent className="pt-1 pb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-brand-navy">{pedidosRollup.tiempoPromedioDias === null ? "—" : `${pedidosRollup.tiempoPromedioDias}d`}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Desde solicitud hasta aprobado/rechazado.</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredPedidos.length === 0 ? (
          <Card className="border-dashed border-2 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Clock className="w-10 h-10 opacity-20" />
              <p className="text-sm">{currentUser.role === "Seller" ? "Aún no has solicitado pedidos extraordinarios." : "No hay pedidos en el filtro actual."}</p>
            </CardContent>
          </Card>
        ) : (
          filteredPedidos.map((p: PedidoExtraordinario) => {
            const isOwner = p.vendedorId === currentUser.id;
            const isAdmin = currentUser.role === "Admin";
            const isCompras = currentUser.role === "Compras";
            const canApprove = (isAdmin || isCompras) && p.estado === "solicitado";
            const canReject = (isAdmin || isCompras) && (p.estado === "solicitado" || p.estado === "aprobado");
            const canMarkPedido = (isAdmin || isCompras) && (p.estado === "solicitado" || p.estado === "aprobado");
            const canSellerCancel = isOwner && p.estado === "solicitado";
            return (
              <Card key={p.id} className="bg-white">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm text-slate-900">{p.productoDescripcion}</h4>
                      <Badge variant="outline" className={estadoStyles[p.estado]}>{estadoLabel[p.estado]}</Badge>
                      {p.productoId && <span className="text-[10px] font-mono text-slate-400">ERP {p.productoId}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>Cantidad: <span className="font-semibold text-slate-700">{p.cantidad}</span></span>
                      <span>Valor: <span className="font-semibold text-slate-700">${p.valorEstimado.toLocaleString()}</span></span>
                      <span>Lead: <span className="font-medium text-slate-700">{p.leadCompany || p.leadId}</span></span>
                      {(isAdmin || isCompras) && p.vendedorName && <span>Vendedor: <span className="font-medium text-slate-700">{p.vendedorName}</span></span>}
                      {p.sucursalName && <span>Sucursal: <span className="font-medium text-slate-700">{p.sucursalName}</span></span>}
                      <span>Solicitado: {new Date(p.createdAt).toLocaleDateString()}</span>
                      {p.resueltoAt && <span>Resuelto: {new Date(p.resueltoAt).toLocaleDateString()}{p.resueltoPorName ? ` por ${p.resueltoPorName}` : ""}</span>}
                    </div>
                    {p.justificacion && (
                      <p className="text-xs text-slate-600 italic mt-2 leading-snug"><span className="font-semibold not-italic text-slate-500">Justificación: </span>{p.justificacion}</p>
                    )}
                    {p.resolucionComentario && (
                      <p className="text-xs text-slate-600 italic mt-1 leading-snug"><span className="font-semibold not-italic text-slate-500">Resolución: </span>{p.resolucionComentario}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {canApprove && (
                      <Button size="sm" variant="default" onClick={() => setResolvePedido({ id: p.id, action: "aprobar", comment: "" })}>Aprobar</Button>
                    )}
                    {canMarkPedido && (
                      <Button size="sm" variant="default" onClick={() => setResolvePedido({ id: p.id, action: "pedido", comment: "" })}>Marcar como pedido</Button>
                    )}
                    {canReject && (
                      <Button size="sm" variant="outline" onClick={() => setResolvePedido({ id: p.id, action: "rechazar", comment: "" })}>Rechazar</Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => startEditPedido(p)}>Editar</Button>
                    )}
                    {(canSellerCancel || (isAdmin && p.estado === "solicitado")) && (
                      <Button size="sm" variant="ghost" onClick={() => cancelPedido(p)}>Cancelar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!resolvePedido} onOpenChange={(open) => { if (!open) setResolvePedido(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {resolvePedido?.action === "aprobar" ? "Aprobar pedido" : resolvePedido?.action === "rechazar" ? "Rechazar pedido" : "Marcar como pedido"}
            </DialogTitle>
            <DialogDescription>
              {resolvePedido?.action === "aprobar"
                ? "Confirma que el pedido se procurará fuera de ventana."
                : resolvePedido?.action === "rechazar"
                  ? "Indica al vendedor por qué no procede esta solicitud."
                  : "Confirma que el pedido ya fue colocado con el proveedor."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <label className="text-sm font-medium">Comentario {resolvePedido?.action === "rechazar" ? "" : "(opcional)"}</label>
            <Textarea
              rows={3}
              placeholder={
                resolvePedido?.action === "aprobar" ? "Notas para compras o el vendedor..." :
                resolvePedido?.action === "rechazar" ? "Razón del rechazo..." :
                "Folio de orden, proveedor, fecha estimada de llegada..."
              }
              value={resolvePedido?.comment || ""}
              onChange={(e) => resolvePedido && setResolvePedido({ ...resolvePedido, comment: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvePedido(null)}>Cancelar</Button>
            <Button onClick={submitResolvePedido}>
              {resolvePedido?.action === "aprobar" ? "Aprobar" : resolvePedido?.action === "rechazar" ? "Rechazar" : "Marcar como pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
