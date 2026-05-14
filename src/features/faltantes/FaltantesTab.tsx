import { useState } from "react";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import type { Client, Product, ProductoFaltante } from "../../types";
import { useFaltantesRollup } from "./useFaltantesRollup";

type NewFaltanteForm = {
  productoId: string;
  productoDescripcion: string;
  cantidad: number;
  comentario: string;
  clienteId: string;
  clienteName: string;
};

const emptyForm: NewFaltanteForm = {
  productoId: "",
  productoDescripcion: "",
  cantidad: 0,
  comentario: "",
  clienteId: "",
  clienteName: "",
};

export function FaltantesTab() {
  const { clients, productos, sucursales, currentUser, refetchFaltantes } = useAppData();

  // Form / dialog state — local to this tab.
  const [isFaltanteOpen, setIsFaltanteOpen] = useState(false);
  const [isProductoSearchOpen, setIsProductoSearchOpen] = useState(false);
  const [productoSearch, setProductoSearch] = useState("");
  const [isFaltanteClientSearchOpen, setIsFaltanteClientSearchOpen] = useState(false);
  const [faltanteClientSearch, setFaltanteClientSearch] = useState("");
  const [newFaltante, setNewFaltante] = useState<NewFaltanteForm>(emptyForm);
  const [editingFaltanteId, setEditingFaltanteId] = useState<string | null>(null);

  // Filter state
  const [filterSucursal, setFilterSucursal] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<"all" | "pendiente" | "resuelto">("all");

  const { monthOptions, filtered: filteredFaltantes, rollup: faltantesRollup } = useFaltantesRollup({
    sucursal: filterSucursal,
    month: filterMonth,
    estado: filterEstado,
  });

  if (!currentUser) return null;

  const resetFaltanteForm = () => {
    setEditingFaltanteId(null);
    setNewFaltante(emptyForm);
    setProductoSearch("");
    setFaltanteClientSearch("");
  };

  const startEditFaltante = (f: ProductoFaltante) => {
    setEditingFaltanteId(f.id);
    setNewFaltante({
      productoId: f.productoId || "",
      productoDescripcion: f.productoDescripcion,
      cantidad: f.cantidad,
      comentario: f.comentario || "",
      clienteId: f.clienteId || "",
      clienteName: f.clienteName || "",
    });
    setProductoSearch("");
    setFaltanteClientSearch("");
    setIsFaltanteOpen(true);
  };

  const handleSubmitFaltante = async () => {
    if (!currentUser) return;
    if (!newFaltante.productoDescripcion.trim()) {
      toast.error("Selecciona un producto o escribe una descripción");
      return;
    }
    if (!newFaltante.cantidad || newFaltante.cantidad <= 0) {
      toast.error("Captura una cantidad válida");
      return;
    }
    const isEdit = !!editingFaltanteId;
    try {
      const res = await fetch(
        isEdit ? `/api/productos-faltantes/${editingFaltanteId}` : "/api/productos-faltantes",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  productoId: newFaltante.productoId || null,
                  productoDescripcion: newFaltante.productoDescripcion,
                  cantidad: newFaltante.cantidad,
                  comentario: newFaltante.comentario,
                  clienteId: newFaltante.clienteId || null,
                }
              : {
                  userId: currentUser.id,
                  productoId: newFaltante.productoId || undefined,
                  productoDescripcion: newFaltante.productoDescripcion,
                  cantidad: newFaltante.cantidad,
                  comentario: newFaltante.comentario,
                  clienteId: newFaltante.clienteId || undefined,
                }
          ),
        }
      );
      if (res.ok) {
        toast.success(isEdit ? "Faltante actualizado" : "Faltante registrado");
        setIsFaltanteOpen(false);
        resetFaltanteForm();
        await refetchFaltantes();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || (isEdit ? "Error al actualizar faltante" : "Error al registrar faltante"));
      }
    } catch {
      toast.error(isEdit ? "Error al actualizar faltante" : "Error al registrar faltante");
    }
  };

  const toggleFaltanteEstado = async (f: ProductoFaltante) => {
    const next = f.estado === "pendiente" ? "resuelto" : "pendiente";
    try {
      const res = await fetch(`/api/productos-faltantes/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: next }),
      });
      if (res.ok) {
        await refetchFaltantes();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error al actualizar");
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Productos Faltantes</h2>
          <p className="text-slate-500">Registra ventas perdidas porque no había el producto que el cliente pedía.</p>
        </div>
        <Dialog open={isFaltanteOpen} onOpenChange={(open) => { setIsFaltanteOpen(open); if (!open) resetFaltanteForm(); }}>
          <DialogTrigger nativeButton={true} render={<Button className="gap-2" />}>
            <Plus className="w-4 h-4" />
            Registrar Faltante
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{editingFaltanteId ? "Editar Producto Faltante" : "Registrar Producto Faltante"}</DialogTitle>
              <DialogDescription>
                Un registro por producto. Si el producto existe en el catálogo ERP, búscalo con el ícono de búsqueda; si no existe, escribe la descripción manualmente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Producto</label>
                <p className="text-[10px] text-slate-500 -mt-1">
                  Solo un producto por registro. Usa el ícono <Search className="inline w-3 h-3 -mt-0.5" /> para buscarlo en el catálogo, o escribe la descripción si no existe.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Descripción del producto"
                    value={newFaltante.productoDescripcion}
                    onChange={(e) => setNewFaltante({ ...newFaltante, productoDescripcion: e.target.value, productoId: "" })}
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
                          placeholder="Buscar por descripción, clave, número de parte, código de barras..."
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
                            const MAX = 50;
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
                                if (matches.length >= MAX) break;
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
                                      setNewFaltante({ ...newFaltante, productoId: p.id, productoDescripcion: p.descripcion });
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
                {newFaltante.productoId && (
                  <p className="text-[10px] text-emerald-700">Vinculado a producto ERP {newFaltante.productoId}</p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Cantidad solicitada</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newFaltante.cantidad || ""}
                  onChange={(e) => setNewFaltante({ ...newFaltante, cantidad: Number(e.target.value) })}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Cliente (opcional)</label>
                <Popover open={isFaltanteClientSearchOpen} onOpenChange={setIsFaltanteClientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {newFaltante.clienteId
                        ? `${newFaltante.clienteId} — ${newFaltante.clienteName}`
                        : "Sin cliente vinculado"}
                      <Search className="w-3 h-3 ml-2 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[320px]" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar cliente por nombre o ID..."
                        value={faltanteClientSearch}
                        onValueChange={setFaltanteClientSearch}
                      />
                      <CommandList>
                        {(() => {
                          const rawQ = faltanteClientSearch.trim().toLowerCase();
                          if (!rawQ) {
                            return (
                              <div className="py-6 text-center text-xs text-slate-500">
                                Opcional — escribe para buscar
                              </div>
                            );
                          }
                          const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
                          const q = squash(rawQ);
                          const norm = (v?: string) => /^\d+$/.test(v || "") ? String(parseInt(v!, 10)) : (v || "").trim();
                          const sellerSucursalId = currentUser?.role === "Seller" ? norm(currentUser.sucursalId) : null;
                          const MAX = 50;
                          const matches: Client[] = [];
                          for (const c of clients) {
                            if (sellerSucursalId && norm(c.sucursalId) !== sellerSucursalId) continue;
                            if (
                              squash(c.company).includes(q) ||
                              squash(c.tradeName || '').includes(q) ||
                              squash(c.name).includes(q) ||
                              c.id.includes(rawQ)
                            ) {
                              matches.push(c);
                              if (matches.length >= MAX) break;
                            }
                          }
                          if (matches.length === 0) return <CommandEmpty>Sin resultados.</CommandEmpty>;
                          return (
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  setNewFaltante({ ...newFaltante, clienteId: "", clienteName: "" });
                                  setIsFaltanteClientSearchOpen(false);
                                }}
                              >
                                <span className="text-xs italic text-slate-500">Sin cliente</span>
                              </CommandItem>
                              {matches.map(c => (
                                <CommandItem
                                  key={c.id}
                                  value={c.id}
                                  onSelect={() => {
                                    setNewFaltante({ ...newFaltante, clienteId: c.id, clienteName: c.tradeName || c.company });
                                    setIsFaltanteClientSearchOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-mono text-slate-500">{c.id}</span>
                                    <span className="text-sm font-medium">{c.tradeName || c.company}</span>
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

              <div className="grid gap-2">
                <label className="text-sm font-medium">Comentario / razón</label>
                <Textarea
                  placeholder="Razón dada por compras o logística (ej. proveedor sin existencia, llegada en 2 semanas, descontinuado...)"
                  value={newFaltante.comentario}
                  onChange={(e) => setNewFaltante({ ...newFaltante, comentario: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFaltanteOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmitFaltante}>{editingFaltanteId ? "Guardar cambios" : "Registrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                const [y, m] = ym.split("-").map(Number);
                return <SelectItem key={ym} value={ym}>{`${MESES[m - 1]} ${y}`}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-brand-gray ml-1">Estado</p>
          <Select value={filterEstado} onValueChange={(v) => setFilterEstado(v as "all" | "pendiente" | "resuelto")}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="resuelto">Resueltos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {currentUser.role === "Admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-white lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-brand-navy">Productos más solicitados sin existencia</CardTitle>
              <CardDescription className="text-[10px]">{faltantesRollup.totalIncidentes} incidentes en el filtro actual</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-[320px] overflow-y-auto">
              {faltantesRollup.topProducts.length === 0 ? (
                <p className="text-xs italic text-slate-400 text-center py-8">Sin datos para el filtro actual.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Producto</TableHead>
                      <TableHead className="text-[10px] text-right">Incid.</TableHead>
                      <TableHead className="text-[10px] text-right">Cant.</TableHead>
                      <TableHead className="text-[10px] text-right">Sucs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faltantesRollup.topProducts.map((p, i) => (
                      <TableRow key={`${p.productoId || p.name}-${i}`}>
                        <TableCell className="text-xs leading-tight">
                          <div className="font-medium text-slate-900 line-clamp-2">{p.name}</div>
                          {p.productoId && <span className="text-[9px] font-mono text-slate-400">{p.productoId}</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-amber-700">{p.incidentes}</TableCell>
                        <TableCell className="text-right text-xs">{p.cantidad}</TableCell>
                        <TableCell className="text-right text-xs">{p.sucursales.size}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-brand-navy">Por sucursal</CardTitle>
              <CardDescription className="text-[10px]">Volumen de incidentes y producto más afectado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
              {faltantesRollup.bySucursal.length === 0 ? (
                <p className="text-xs italic text-slate-400 text-center py-8">Sin datos.</p>
              ) : (() => {
                const max = faltantesRollup.bySucursal[0]?.incidentes || 1;
                return faltantesRollup.bySucursal.map(s => (
                  <div key={s.name} className="space-y-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate pr-2">{s.name}</span>
                      <span className="font-bold text-amber-700">{s.incidentes}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(s.incidentes / max) * 100}%` }} />
                    </div>
                    {s.topProduct && (
                      <p className="text-[10px] text-slate-500 truncate">
                        Top: <span className="text-slate-700">{s.topProduct}</span> <span className="text-slate-400">×{s.topProductCount}</span>
                      </p>
                    )}
                  </div>
                ));
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {currentUser.role === "Admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-4">
            <Card className="bg-white">
              <CardHeader className="pb-1 pt-3">
                <CardDescription className="text-[10px] uppercase tracking-wide">Cobertura del catálogo</CardDescription>
              </CardHeader>
              <CardContent className="pt-1 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${faltantesRollup.freeTextPct >= 30 ? "text-amber-700" : "text-brand-navy"}`}>{faltantesRollup.freeTextPct}%</span>
                  <span className="text-[10px] text-slate-500">descripciones libres</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {faltantesRollup.freeTextCount} sin vínculo a producto ERP — posible brecha en el catálogo.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white flex-1 min-h-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-brand-navy">Recurrencia crónica</CardTitle>
                <CardDescription className="text-[10px]">Productos faltantes en 3 o más meses distintos (ignora el filtro de mes)</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                {faltantesRollup.recurrentes.length === 0 ? (
                  <p className="text-xs italic text-slate-400 text-center py-8">Aún no hay productos con recurrencia crónica.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Producto</TableHead>
                        <TableHead className="text-[10px] text-right">Meses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faltantesRollup.recurrentes.map((p, i) => (
                        <TableRow key={`${p.key}-${i}`}>
                          <TableCell className="text-xs leading-tight">
                            <div className="font-medium text-slate-900 line-clamp-2">{p.name}</div>
                            {p.productoId && <span className="text-[9px] font-mono text-slate-400">{p.productoId}</span>}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-amber-700">{p.meses}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-brand-navy">Clientes más afectados</CardTitle>
              <CardDescription className="text-[10px]">Quiénes pierden más oportunidades por falta de stock</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-[320px] overflow-y-auto">
              {faltantesRollup.topClientes.length === 0 ? (
                <p className="text-xs italic text-slate-400 text-center py-8">Sin clientes vinculados en el filtro actual.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Cliente</TableHead>
                      <TableHead className="text-[10px] text-right">Incid.</TableHead>
                      <TableHead className="text-[10px] text-right">Cant.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faltantesRollup.topClientes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs leading-tight">
                          <div className="font-medium text-slate-900 line-clamp-2">{c.name}</div>
                          <span className="text-[9px] font-mono text-slate-400">{c.id}</span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-amber-700">{c.incidentes}</TableCell>
                        <TableCell className="text-right text-xs">{c.cantidad}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-brand-navy">Productos nuevos este mes</CardTitle>
              <CardDescription className="text-[10px]">Productos que aparecen como faltantes por primera vez en {faltantesRollup.currLabel}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-[320px] overflow-y-auto">
              {faltantesRollup.productosNuevos.length === 0 ? (
                <p className="text-xs italic text-slate-400 text-center py-8">Sin productos nuevos este mes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Producto</TableHead>
                      <TableHead className="text-[10px] text-right">Incid.</TableHead>
                      <TableHead className="text-[10px] text-right">Cant.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faltantesRollup.productosNuevos.map((p, i) => (
                      <TableRow key={`${p.key}-${i}`}>
                        <TableCell className="text-xs leading-tight">
                          <div className="font-medium text-slate-900 line-clamp-2">{p.name}</div>
                          {p.productoId && <span className="text-[9px] font-mono text-slate-400">{p.productoId}</span>}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-amber-700">{p.incidentes}</TableCell>
                        <TableCell className="text-right text-xs">{p.cantidad}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {(() => {
          const visible = filteredFaltantes;
          if (visible.length === 0) {
            return (
              <Card className="border-dashed border-2 bg-transparent">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <AlertTriangle className="w-10 h-10 opacity-20" />
                  <p className="text-sm">{currentUser.role === "Seller" ? "Aún no has registrado faltantes." : "No hay faltantes registrados."}</p>
                </CardContent>
              </Card>
            );
          }
          return visible.map(f => (
            <Card key={f.id} className="bg-white">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-slate-900">{f.productoDescripcion}</h4>
                    <Badge variant="outline" className={f.estado === "pendiente" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                      {f.estado === "pendiente" ? "Pendiente" : "Resuelto"}
                    </Badge>
                    {f.productoId && <span className="text-[10px] font-mono text-slate-400">ERP {f.productoId}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>Cantidad: <span className="font-semibold text-slate-700">{f.cantidad}</span></span>
                    {f.clienteName && <span>Cliente: <span className="font-medium text-slate-700">{f.clienteName}</span></span>}
                    {currentUser.role === "Admin" && f.vendedorName && <span>Vendedor: <span className="font-medium text-slate-700">{f.vendedorName}</span></span>}
                    {f.sucursalName && <span>Sucursal: <span className="font-medium text-slate-700">{f.sucursalName}</span></span>}
                    <span>Registrado: {new Date(f.createdAt).toLocaleDateString()}</span>
                  </div>
                  {f.comentario && (
                    <p className="text-xs text-slate-600 italic mt-2 leading-snug">{f.comentario}</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  {currentUser.role === "Admin" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditFaltante(f)}
                    >
                      Editar
                    </Button>
                  )}
                  {(currentUser.role === "Admin" || f.vendedorId === currentUser.id) && (
                    <Button
                      size="sm"
                      variant={f.estado === "pendiente" ? "outline" : "ghost"}
                      onClick={() => toggleFaltanteEstado(f)}
                    >
                      {f.estado === "pendiente" ? "Marcar resuelto" : "Reabrir"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ));
        })()}
      </div>
    </>
  );
}
