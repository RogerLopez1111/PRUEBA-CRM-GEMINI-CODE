/**
 * Lead status-update dialog — cross-cutting modal used by Kanban (on drop and
 * card click), My Leads, and Admin's workload pile. Owns its own state and
 * exposes an imperative `open(lead, newStatus?)` method via a forwardRef
 * handle so callers don't have to thread state down.
 *
 * Left side shows the timeline; right side appears when the user picks a new
 * status (or one was preselected on drag-drop) and collects the comment +
 * stage-specific fields (cotizado/facturado/rechazado, plus ERP-link picker
 * when facturando a CRM-prospect lead).
 */
import { forwardRef, useImperativeHandle, useState } from "react";
import {
  History, MessageSquare, Plus, Trash2, TrendingUp, FileText, XCircle,
  CheckCircle2, Search, Building2, Paperclip,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { isCrmClientId } from "../../lib/helpers";
import { useAppData } from "../../state/AppDataContext";
import type { Client, Lead, LeadStatus } from "../../types";
import { getStatusBadge } from "./getStatusBadge";

export interface StatusUpdateDialogHandle {
  open: (lead: Lead, newStatus?: LeadStatus) => void;
}

interface FormState {
  status: LeadStatus;
  comment: string;
  evidenceUrl: string;
  quotedAmount: number;
  invoicedAmount: number;
  rechazoMotivoId: number;
  erpClientId: string;
}

const emptyForm: FormState = {
  status: "" as LeadStatus,
  comment: "",
  evidenceUrl: "",
  quotedAmount: 0,
  invoicedAmount: 0,
  rechazoMotivoId: 0,
  erpClientId: "",
};

export const StatusUpdateDialog = forwardRef<StatusUpdateDialogHandle>((_, ref) => {
  const { users, clients, rechazoMotivos, currentUser, refetchAll } = useAppData();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isErpClientSearchOpen, setIsErpClientSearchOpen] = useState(false);
  const [erpClientSearch, setErpClientSearch] = useState("");

  useImperativeHandle(ref, () => ({
    open: (lead, newStatus) => {
      setSelectedLead(lead);
      setForm({
        status: newStatus || lead.status,
        comment: "",
        evidenceUrl: "",
        quotedAmount: lead.quotedAmount || 0,
        invoicedAmount: lead.invoicedAmount || 0,
        rechazoMotivoId: 0,
        erpClientId: "",
      });
      setErpClientSearch("");
      setIsOpen(true);
    },
  }), []);

  const submitStatusChange = async (overrides?: Partial<FormState>) => {
    if (!selectedLead) return;
    const f = { ...form, ...overrides };
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: f.status,
          comment: f.comment,
          evidenceUrl: f.evidenceUrl,
          quotedAmount: f.quotedAmount,
          invoicedAmount: f.invoicedAmount,
          rechazoMotivoId: f.rechazoMotivoId || undefined,
          erpClientId: f.erpClientId || undefined,
          userId: currentUser?.id,
        }),
      });
      if (res.ok) {
        if (f.status === "FACTURADO") toast.success("Lead facturado y vinculado al cliente ERP");
        else toast.success(`Lead marcado como ${f.status}`);
        setIsOpen(false);
        setForm(emptyForm);
        setErpClientSearch("");
        refetchAll();
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        toast.error(data.error || "Failed to update status");
      }
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    if (currentUser?.role !== "Admin") return;
    const label = selectedLead.company || selectedLead.name || selectedLead.id;
    if (!window.confirm(`¿Eliminar el lead "${label}" y todo su historial? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/leads/${selectedLead.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        toast.error(body.error || "No se pudo eliminar el lead");
        return;
      }
      toast.success("Lead eliminado");
      setIsOpen(false);
      setSelectedLead(null);
      refetchAll();
    } catch (e) {
      toast.error("No se pudo eliminar el lead");
    }
  };

  const sameStatus = form.status === selectedLead?.status;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="flex flex-col md:flex-row h-full">
          {/* Left Side: Timeline History */}
          <div className={cn(
            "flex flex-col border-slate-100",
            sameStatus ? "w-full" : "w-full md:w-1/2 border-r"
          )}>
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Historial: {selectedLead?.name}
              </DialogTitle>
              <DialogDescription>
                Línea de tiempo de todos los cambios de estado y comentarios.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-4">
              <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
                {!selectedLead || selectedLead.history.length === 0 ? (
                  <p className="text-center text-slate-400 italic py-8">Aún no se ha registrado historial.</p>
                ) : (
                  [...selectedLead.history].reverse().map((item) => {
                    const author = users.find(u => u.id === item.updatedBy);
                    const authorName = author?.name || "Sistema";
                    const authorInitial = authorName.charAt(0).toUpperCase();
                    return (
                      <div key={item.id} className="relative pl-8">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-primary" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(item.status)}
                              <span className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                                {authorInitial}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700">{authorName}</span>
                              {author?.role && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 border-slate-200 text-slate-500">
                                  {author.role === "Admin" ? "Admin" : "Vendedor"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-700 mt-1">{item.comment}</p>
                          {item.rechazoMotivo && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <XCircle className="w-3 h-3 text-red-600" />
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100 text-[10px] py-0">
                                Motivo: {item.rechazoMotivo}
                              </Badge>
                            </div>
                          )}
                          {(item.quotedAmount !== undefined || item.invoicedAmount !== undefined) && (
                            <div className="flex gap-2 mt-2">
                              {item.quotedAmount !== undefined && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-100 text-[9px] py-0">
                                  Cotizado: ${item.quotedAmount.toLocaleString()}
                                </Badge>
                              )}
                              {item.invoicedAmount !== undefined && (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[9px] py-0">
                                  Facturado: ${item.invoicedAmount.toLocaleString()}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {sameStatus && (
              <div className="p-4 bg-white border-t space-y-3">
                <label className="text-sm font-semibold text-brand-navy flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" />
                  Agregar Comentario
                </label>
                <Input
                  placeholder="Escribe un comentario..."
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
                <div className="flex items-center justify-between gap-2">
                  {currentUser?.role === "Admin" && selectedLead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                      onClick={handleDeleteLead}
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar lead
                    </Button>
                  )}
                  <div className="flex justify-end gap-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>Cerrar</Button>
                    <Button
                      size="sm"
                      disabled={!form.comment.trim()}
                      onClick={() => submitStatusChange({ status: selectedLead!.status })}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Update Form */}
          {!sameStatus && (
            <div className="w-full md:w-1/2 flex flex-col bg-slate-50/30">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Nueva Actualización
                </DialogTitle>
                <DialogDescription>
                  Registra un nuevo avance para este lead.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-brand-navy">Nuevo Estado</label>
                  <Select
                    value={form.status}
                    onValueChange={(val) => setForm({ ...form, status: val as LeadStatus })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASIGNADO">Asignado</SelectItem>
                      <SelectItem value="CONTACTADO">Contactado</SelectItem>
                      <SelectItem value="NEGOCIACION">Negociación</SelectItem>
                      <SelectItem value="COTIZADO">Cotizado</SelectItem>
                      <SelectItem value="FACTURADO">Facturado</SelectItem>
                      <SelectItem value="ENTREGADO">Entregado</SelectItem>
                      <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-brand-navy flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" />
                    Comentario
                  </label>
                  <Input
                    placeholder="Describe el avance..."
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    className="bg-white"
                  />
                </div>

                {form.status === "COTIZADO" && (
                  <div className="grid gap-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <label className="text-xs font-bold text-orange-700 flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" />
                      Monto Cotizado ($)
                    </label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={form.quotedAmount || ""}
                      onChange={(e) => setForm({ ...form, quotedAmount: Number(e.target.value) })}
                      className="bg-white border-orange-200 focus-visible:ring-orange-500 h-8 text-sm"
                    />
                  </div>
                )}

                {form.status === "FACTURADO" && (
                  <div className="grid gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <div className="grid gap-2">
                      <label className="text-xs font-bold text-indigo-700 flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        Monto Facturado ($)
                      </label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={form.invoicedAmount || ""}
                        onChange={(e) => setForm({ ...form, invoicedAmount: Number(e.target.value) })}
                        className="bg-white border-indigo-200 focus-visible:ring-indigo-500 h-8 text-sm"
                      />
                    </div>

                    {selectedLead && isCrmClientId(selectedLead.clientId) && (
                      <div className="grid gap-2">
                        <label className="text-xs font-bold text-indigo-700 flex items-center gap-2">
                          <Building2 className="w-3 h-3" />
                          Cliente ERP a vincular
                        </label>
                        <p className="text-[10px] text-indigo-700/70 -mt-1">
                          Este lead aún apunta a un prospecto CRM. Selecciona el ID del cliente ERP que ya existe para vincularlo.
                        </p>
                        <Popover open={isErpClientSearchOpen} onOpenChange={setIsErpClientSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal bg-white border-indigo-200 h-8 text-sm">
                              {form.erpClientId
                                ? (() => {
                                    const c = clients.find(c => c.id === form.erpClientId);
                                    return c
                                      ? `${form.erpClientId} — ${c.tradeName || c.company}`
                                      : form.erpClientId;
                                  })()
                                : "Buscar cliente ERP por ID, nombre, RFC..."}
                              <Search className="w-3 h-3 ml-2 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[320px]" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="ID, nombre comercial, razón social, RFC..."
                                value={erpClientSearch}
                                onValueChange={setErpClientSearch}
                              />
                              <CommandList>
                                {(() => {
                                  const rawQ = erpClientSearch.trim().toLowerCase();
                                  if (!rawQ) {
                                    return (
                                      <div className="py-6 text-center text-xs text-slate-500">
                                        Escribe para buscar entre los clientes ERP
                                      </div>
                                    );
                                  }
                                  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
                                  const q = squash(rawQ);
                                  const MAX = 50;
                                  const matches: Client[] = [];
                                  // Sellers can only link clients from their own sucursal; admins see all
                                  const norm = (v?: string) => /^\d+$/.test(v || "") ? String(parseInt(v!, 10)) : (v || "").trim();
                                  const sellerSucursalId = currentUser?.role === "Seller" ? norm(currentUser.sucursalId) : null;
                                  for (const c of clients) {
                                    if (c.source !== "erp") continue;
                                    if (sellerSucursalId && norm(c.sucursalId) !== sellerSucursalId) continue;
                                    const stripped = c.id.replace(/^0+/, "");
                                    if (
                                      squash(c.company).includes(q) ||
                                      squash(c.tradeName || "").includes(q) ||
                                      squash(c.name).includes(q) ||
                                      squash(c.rfc || "").includes(q) ||
                                      c.id.includes(rawQ) ||
                                      stripped.includes(rawQ)
                                    ) {
                                      matches.push(c);
                                      if (matches.length >= MAX) break;
                                    }
                                  }
                                  if (matches.length === 0) {
                                    return <CommandEmpty>No se encontraron clientes ERP.</CommandEmpty>;
                                  }
                                  return (
                                    <CommandGroup>
                                      {matches.map(c => (
                                        <CommandItem
                                          key={c.id}
                                          value={c.id}
                                          onSelect={() => {
                                            setForm({ ...form, erpClientId: c.id });
                                            setIsErpClientSearchOpen(false);
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span className="text-xs font-mono text-slate-500">{c.id}</span>
                                            <span className="text-sm font-medium">{c.tradeName || c.company}</span>
                                            {c.tradeName && <span className="text-[10px] text-slate-400">{c.company}</span>}
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
                    )}
                  </div>
                )}

                {form.status === "RECHAZADO" && (
                  <div className="grid gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                    <label className="text-xs font-bold text-red-700 flex items-center gap-2">
                      <XCircle className="w-3 h-3" />
                      Motivo del Rechazo
                    </label>
                    <Select
                      value={form.rechazoMotivoId ? String(form.rechazoMotivoId) : ""}
                      onValueChange={(val) => setForm({ ...form, rechazoMotivoId: Number(val) })}
                    >
                      <SelectTrigger className="bg-white border-red-200 focus-visible:ring-red-500 h-8 text-sm">
                        <SelectValue placeholder="Seleccionar motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {rechazoMotivos.map(m => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-brand-navy flex items-center gap-2">
                    <Paperclip className="w-3 h-3" />
                    URL de Evidencia (Opcional)
                  </label>
                  <Input
                    placeholder="https://example.com/evidencia.pdf"
                    value={form.evidenceUrl}
                    onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
                    className="bg-white h-8 text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="p-6 bg-white border-t flex items-center justify-between sm:justify-between">
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button
                  size="sm"
                  onClick={() => submitStatusChange()}
                  disabled={
                    !form.comment ||
                    (form.status === "RECHAZADO" && !form.rechazoMotivoId) ||
                    (form.status === "FACTURADO" && selectedLead != null && isCrmClientId(selectedLead.clientId) && !form.erpClientId)
                  }
                  className="gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Actualización
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

StatusUpdateDialog.displayName = "StatusUpdateDialog";
