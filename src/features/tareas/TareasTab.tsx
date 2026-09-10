/**
 * "Tareas" tab — admin-created tasks/alerts (e.g. "offer this overstocked
 * product to clients") assigned to one or more sellers. Sellers work a task by
 * creating leads linked to it (via the Tarea selector in the New Lead dialog);
 * an admin closes it when done. Admins see the linked-leads count per task.
 */
import { useMemo, useState } from "react";
import { ListChecks, Plus, Search, Check, Users } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
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

import { useAppData } from "../../state/AppDataContext";
import { apiFetch } from "../../lib/api";
import { getStatusBadge } from "../leads/getStatusBadge";
import type { Lead, Product, Tarea, TareaEstado } from "../../types";

const estadoStyles: Record<string, string> = {
  abierta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cerrada: "bg-slate-100 text-slate-600 border-slate-200",
};
const estadoLabel: Record<string, string> = {
  abierta: "Abierta",
  cerrada: "Cerrada",
};

type TareaForm = {
  titulo: string;
  descripcion: string;
  productoId: string;
  productoDescripcion: string;
  asignados: string[];
};

const emptyForm: TareaForm = {
  titulo: "", descripcion: "",
  productoId: "", productoDescripcion: "",
  asignados: [],
};

export function TareasTab() {
  const { tareas, leads, users, currentUser, productos, sucursales, refetchTareas } = useAppData();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TareaForm>(emptyForm);
  const [isProductoSearchOpen, setIsProductoSearchOpen] = useState(false);
  const [productoSearch, setProductoSearch] = useState("");
  const [isSellerPickerOpen, setIsSellerPickerOpen] = useState(false);
  const [viewLeadsTask, setViewLeadsTask] = useState<Tarea | null>(null);

  const [filterEstado, setFilterEstado] = useState<"all" | TareaEstado>("all");

  const isAdmin = currentUser?.role === "Admin";

  // Only sellers can be assigned tasks.
  const sellers = useMemo(() => users.filter((u) => u.role === "Seller"), [users]);

  const filteredTareas = useMemo(
    () => tareas.filter((t) => filterEstado === "all" || t.estado === filterEstado),
    [tareas, filterEstado]
  );

  // Leads linked to a task, scoped by role: admins see every linked lead;
  // sellers see only their own leads linked to the task.
  const leadsForTask = (taskId: string): Lead[] =>
    leads.filter(
      (l) => l.tareaId === taskId && (isAdmin || l.assignedTo === currentUser?.id)
    );

  if (!currentUser) return null;

  const viewLeads = viewLeadsTask ? leadsForTask(viewLeadsTask.id) : [];

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setProductoSearch("");
  };

  const startEdit = (t: Tarea) => {
    setEditingId(t.id);
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion || "",
      productoId: t.productoId || "",
      productoDescripcion: t.productoDescripcion || "",
      asignados: t.asignados.map((a) => a.vendedorId),
    });
    setProductoSearch("");
    setIsOpen(true);
  };

  const toggleAsignado = (vid: string) => {
    setForm((f) => ({
      ...f,
      asignados: f.asignados.includes(vid)
        ? f.asignados.filter((x) => x !== vid)
        : [...f.asignados, vid],
    }));
  };

  const handleSubmit = async () => {
    if (!form.titulo.trim()) { toast.error("Escribe un título para la tarea"); return; }
    if (form.asignados.length === 0) { toast.error("Asigna la tarea al menos a un vendedor"); return; }

    const isEdit = !!editingId;
    const body = {
      titulo: form.titulo,
      descripcion: form.descripcion,
      productoId: form.productoId || null,
      productoDescripcion: form.productoDescripcion || null,
      asignados: form.asignados,
    };
    try {
      const res = await apiFetch(
        isEdit ? `/api/tareas/${editingId}` : "/api/tareas",
        { method: isEdit ? "PATCH" : "POST", body: JSON.stringify(body) }
      );
      if (res.ok) {
        toast.success(isEdit ? "Tarea actualizada" : "Tarea creada");
        setIsOpen(false);
        resetForm();
        await refetchTareas();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || (isEdit ? "Error al actualizar la tarea" : "Error al crear la tarea"));
      }
    } catch {
      toast.error(isEdit ? "Error al actualizar la tarea" : "Error al crear la tarea");
    }
  };

  const setEstado = async (t: Tarea, estado: TareaEstado) => {
    try {
      const res = await apiFetch(`/api/tareas/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado }),
      });
      if (res.ok) {
        toast.success(estado === "cerrada" ? "Tarea cerrada" : "Tarea reabierta");
        await refetchTareas();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al actualizar la tarea");
      }
    } catch {
      toast.error("Error al actualizar la tarea");
    }
  };

  const deleteTarea = async (t: Tarea) => {
    if (!window.confirm(`¿Eliminar la tarea "${t.titulo}"?`)) return;
    try {
      const res = await apiFetch(`/api/tareas/${t.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Tarea eliminada");
        await refetchTareas();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al eliminar la tarea");
      }
    } catch {
      toast.error("Error al eliminar la tarea");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tareas</h2>
          <p className="text-slate-500">
            {isAdmin
              ? "Crea alertas o tareas (p. ej. ofrecer un producto con inventario excedente) y asígnalas a tus vendedores. Los vendedores las trabajan creando leads vinculados."
              : "Tareas que te han asignado. Trabájalas creando leads y vinculándolos a la tarea desde el diálogo de Nuevo Lead."}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger nativeButton={true} render={<Button className="gap-2" />}>
              <Plus className="w-4 h-4" />
              Nueva Tarea
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Tarea" : "Nueva Tarea"}</DialogTitle>
                <DialogDescription>
                  Describe la tarea y asígnala a uno o más vendedores. Ellos la trabajarán creando leads vinculados a esta tarea.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Título</label>
                  <Input
                    placeholder="Ofrecer Producto X con inventario excedente"
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Descripción</label>
                  <Textarea
                    placeholder="Contexto de la tarea, condiciones, meta, etc."
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Producto (opcional)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Descripción del producto"
                      value={form.productoDescripcion}
                      onChange={(e) => setForm({ ...form, productoDescripcion: e.target.value, productoId: "" })}
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
                                        setForm({ ...form, productoId: p.id, productoDescripcion: p.descripcion });
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
                  {form.productoId && (
                    <p className="text-[10px] text-emerald-700">Vinculado a producto ERP {form.productoId}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium">Asignar a vendedores</label>
                  <Popover open={isSellerPickerOpen} onOpenChange={setIsSellerPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {form.asignados.length === 0
                          ? "Selecciona uno o más vendedores"
                          : `${form.asignados.length} vendedor(es) seleccionado(s)`}
                        <Users className="w-4 h-4 ml-2 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[340px]" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar vendedor..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron vendedores.</CommandEmpty>
                          <CommandGroup>
                            {sellers.map((u) => {
                              const selected = form.asignados.includes(u.id);
                              return (
                                <CommandItem
                                  key={u.id}
                                  value={u.name}
                                  onSelect={() => toggleAsignado(u.id)}
                                >
                                  <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded border ${selected ? "bg-primary border-primary text-primary-foreground" : "border-slate-300"}`}>
                                    {selected && <Check className="w-3 h-3" />}
                                  </div>
                                  <span className="text-sm">{u.name}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {form.asignados.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {form.asignados.map((vid) => {
                        const u = users.find((x) => x.id === vid);
                        return (
                          <Badge key={vid} variant="outline" className="gap-1">
                            {u?.name || vid}
                            <button
                              type="button"
                              className="ml-1 text-slate-400 hover:text-slate-700"
                              onClick={() => toggleAsignado(vid)}
                            >
                              ×
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit}>{editingId ? "Guardar cambios" : "Crear tarea"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-brand-gray ml-1">Estado</p>
          <Select value={filterEstado} onValueChange={(v) => setFilterEstado(v as "all" | TareaEstado)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="abierta">Abiertas</SelectItem>
              <SelectItem value="cerrada">Cerradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTareas.length === 0 ? (
          <Card className="border-dashed border-2 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <ListChecks className="w-10 h-10 opacity-20" />
              <p className="text-sm">
                {isAdmin ? "No hay tareas en el filtro actual." : "No tienes tareas asignadas."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTareas.map((t) => {
            const linkedCount = leadsForTask(t.id).length;
            return (
            <Card
              key={t.id}
              className="bg-white cursor-pointer transition-colors hover:border-brand-navy/40 hover:bg-slate-50/60"
              onClick={() => setViewLeadsTask(t)}
              role="button"
              title="Ver leads vinculados"
            >
              <CardContent className="p-4 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-slate-900">{t.titulo}</h4>
                    <Badge variant="outline" className={estadoStyles[t.estado]}>{estadoLabel[t.estado]}</Badge>
                    {t.productoId && <span className="text-[10px] font-mono text-slate-400">ERP {t.productoId}</span>}
                  </div>
                  {t.descripcion && (
                    <p className="text-xs text-slate-600 leading-snug mb-2">{t.descripcion}</p>
                  )}
                  {t.productoDescripcion && (
                    <p className="text-[11px] text-slate-500 mb-2">Producto: <span className="font-medium text-slate-700">{t.productoDescripcion}</span></p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>
                      {isAdmin ? "Leads vinculados" : "Mis leads vinculados"}:{" "}
                      <span className="font-semibold text-brand-navy">{linkedCount}</span>
                      <span className="text-slate-400"> · ver detalle</span>
                    </span>
                    <span>
                      Asignada a:{" "}
                      <span className="font-medium text-slate-700">
                        {t.asignados.length > 0
                          ? t.asignados.map((a) => a.vendedorName || a.vendedorId).join(", ")
                          : "—"}
                      </span>
                    </span>
                    <span>Creada: {new Date(t.createdAt).toLocaleDateString()}{t.creadoPorName ? ` por ${t.creadoPorName}` : ""}</span>
                    {t.cerradoAt && (
                      <span>Cerrada: {new Date(t.cerradoAt).toLocaleDateString()}{t.cerradoPorName ? ` por ${t.cerradoPorName}` : ""}</span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {t.estado === "abierta" ? (
                      <Button size="sm" variant="default" onClick={() => setEstado(t, "cerrada")}>Cerrar</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setEstado(t, "abierta")}>Reabrir</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => startEdit(t)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteTarea(t)}>Eliminar</Button>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!viewLeadsTask} onOpenChange={(open) => { if (!open) setViewLeadsTask(null); }}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="pr-6">{viewLeadsTask?.titulo}</DialogTitle>
            <DialogDescription>
              {isAdmin
                ? "Leads vinculados a esta tarea."
                : "Tus leads vinculados a esta tarea."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {viewLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                <ListChecks className="w-9 h-9 opacity-20" />
                <p className="text-sm">
                  {isAdmin ? "Aún no hay leads vinculados a esta tarea." : "Aún no tienes leads vinculados a esta tarea."}
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {viewLeads.map((l) => {
                  const seller = users.find((u) => u.id === l.assignedTo);
                  const sucursalName = seller ? (sucursales.find((s) => s.id === seller.sucursalId)?.name || l.sucursal) : l.sucursal;
                  return (
                    <div key={l.id} className="rounded-md border bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-slate-900 truncate">{l.company || l.name || "—"}</p>
                          {l.name && l.company && <p className="text-[11px] text-slate-500 truncate">{l.name}</p>}
                          {l.email && <p className="text-[11px] text-slate-400 truncate">{l.email}</p>}
                        </div>
                        <div className="shrink-0">{getStatusBadge(l.status)}</div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-2">
                        <span>Valor: <span className="font-semibold text-slate-700">${l.value.toLocaleString()}</span></span>
                        {isAdmin && <span>Vendedor: <span className="font-medium text-slate-700">{seller?.name || l.assignedTo || "—"}</span></span>}
                        {sucursalName && <span>Sucursal: <span className="font-medium text-slate-700">{sucursalName}</span></span>}
                        {l.segmento && <span>Segmento: <span className="font-medium text-slate-700">{l.segmento}</span></span>}
                        <span>Creado: {new Date(l.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
