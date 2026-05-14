/**
 * "Nuevo Lead" dialog — header button + form. Sellers create leads assigned to
 * themselves; admins must pick a vendedor. The client picker lets you attach
 * an existing ERP client (which then constrains the assignable vendedores to
 * the client's sucursal). Hidden from the Compras role.
 */
import { useEffect, useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

import { useAppData } from "../../state/AppDataContext";
import type { Client } from "../../types";

const norm = (v?: string) => (/^\d+$/.test(v || "") ? String(parseInt(v!, 10)) : (v || "").trim());

interface NewLeadForm {
  name: string;
  email: string;
  company: string;
  value: number;
  sucursal: string;
  segmento: string;
  isExistingClient: boolean;
  clientId: string;
  assignedTo: string;
  clientInitiated: boolean;
  mostrador: boolean;
}

function emptyForm(): NewLeadForm {
  return {
    name: "", email: "", company: "", value: 0,
    sucursal: "", segmento: "",
    isExistingClient: false, clientId: "", assignedTo: "",
    clientInitiated: false, mostrador: false,
  };
}

export function NewLeadDialog() {
  const { clients, users, sucursales, segmentos, currentUser, refetchAll } = useAppData();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [isSellerSearchOpen, setIsSellerSearchOpen] = useState(false);
  const [form, setForm] = useState<NewLeadForm>(emptyForm);

  // Apply seller-default sucursal/segmento once context data is loaded or the
  // current user changes — same behavior the create form had when it lived in
  // App.tsx after the old fetchData() call.
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      sucursal: prev.sucursal
        || (currentUser?.role === "Seller" ? sucursales.find(s => s.id === currentUser.sucursalId)?.name : "")
        || (sucursales.length > 0 ? sucursales[0].name : ""),
      segmento: prev.segmento || (segmentos.length > 0 ? segmentos[0].name : ""),
    }));
  }, [sucursales, segmentos, currentUser]);

  const resetForm = () => {
    setForm({
      ...emptyForm(),
      sucursal: (currentUser?.role === "Seller" ? sucursales.find(s => s.id === currentUser.sucursalId)?.name : "")
        || (sucursales.length > 0 ? sucursales[0].name : ""),
      segmento: segmentos.length > 0 ? segmentos[0].name : "",
    });
  };

  const handleSubmit = async () => {
    if (isCreating) return;
    if (!form.company.trim()) {
      toast.error("Selecciona o escribe una empresa");
      return;
    }
    if (currentUser?.role === "Admin" && !form.assignedTo) {
      toast.error("Asigna el lead a un vendedor");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          userId: currentUser?.role === "Seller" ? currentUser.id : form.assignedTo,
        }),
      });
      if (res.ok) {
        toast.success(currentUser?.role === "Seller" ? "Lead creado y asignado a ti" : "Nuevo lead creado");
        setIsOpen(false);
        resetForm();
        refetchAll();
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        toast.error(data.error || "Error al crear lead");
      }
    } catch (e) {
      toast.error("Error al crear lead");
    } finally {
      setIsCreating(false);
    }
  };

  if (currentUser?.role === "Compras") return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isCreating) setIsOpen(open); }}>
      <DialogTrigger nativeButton={true} render={<Button className="gap-2" />}>
        <Plus className="w-4 h-4" />
        Nuevo Lead
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Lead</DialogTitle>
          <DialogDescription>
            Registra un nuevo lead en el sistema. Puedes crear un cliente nuevo o seleccionar uno existente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Empresa</label>
            <div className="flex gap-2">
              <Input
                placeholder="TechCorp"
                value={form.company}
                onChange={(e) => setForm({
                  ...form,
                  company: e.target.value,
                  isExistingClient: false,
                  clientId: "",
                })}
                className="flex-1"
              />
              <Popover open={isClientSearchOpen} onOpenChange={setIsClientSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Search className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[300px]" align="end">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar por nombre comercial, razón social, contacto, email, RFC o ID..."
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      {(() => {
                        const rawQ = clientSearch.trim().toLowerCase();
                        if (!rawQ) {
                          return (
                            <div className="py-6 text-center text-xs text-slate-500">
                              Escribe para buscar entre {clients.length.toLocaleString()} clientes
                            </div>
                          );
                        }
                        // Whitespace-insensitive so "control de plagas" matches "controldeplagas"
                        const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
                        const q = squash(rawQ);
                        const MAX = 50;
                        const matches: Client[] = [];
                        // Sellers can only pick existing clients from their own sucursal
                        const sellerSucursalId = currentUser?.role === "Seller" ? norm(currentUser.sucursalId) : null;
                        for (const c of clients) {
                          if (sellerSucursalId && norm(c.sucursalId) !== sellerSucursalId) continue;
                          const stripped = c.id.replace(/^0+/, "");
                          if (
                            squash(c.company).includes(q) ||
                            squash(c.tradeName || "").includes(q) ||
                            squash(c.name).includes(q) ||
                            squash(c.email || "").includes(q) ||
                            squash(c.rfc || "").includes(q) ||
                            c.id.includes(rawQ) ||
                            stripped.includes(rawQ)
                          ) {
                            matches.push(c);
                            if (matches.length >= MAX) break;
                          }
                        }
                        if (matches.length === 0) {
                          return <CommandEmpty>No se encontraron clientes.</CommandEmpty>;
                        }
                        return matches.map((client: Client) => (
                          <CommandItem
                            key={client.id}
                            value={client.id}
                            onSelect={() => {
                              setForm({
                                ...form,
                                isExistingClient: true,
                                clientId: client.id,
                                name: client.name,
                                company: client.company,
                                email: client.email,
                                sucursal: sucursales.find(s => s.id === client.sucursalId)?.name || form.sucursal,
                                segmento: client.segmento || form.segmento,
                              });
                              setClientSearch("");
                              setIsClientSearchOpen(false);
                            }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{client.tradeName || client.company}</span>
                              {client.tradeName && client.company && (
                                <span className="text-xs text-slate-500">{client.company}</span>
                              )}
                              {client.name && <span className="text-xs text-slate-500">{client.name}</span>}
                              {client.rfc && <span className="text-[10px] text-slate-400">{client.rfc}</span>}
                            </div>
                          </CommandItem>
                        ));
                      })()}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Valor Potencial ($)</label>
            <Input
              type="number"
              placeholder="5000"
              value={form.value || ""}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-start gap-2 p-3 rounded-md bg-slate-50 border select-none ${form.mostrador ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                className="h-4 w-4 mt-0.5 accent-primary"
                checked={form.clientInitiated}
                disabled={form.mostrador}
                onChange={(e) => setForm({ ...form, clientInitiated: e.target.checked })}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Cliente me contactó</span>
                <span className="text-[11px] text-slate-500">{form.mostrador ? "Implícito por Mostrador." : "El cliente inició el contacto."}</span>
              </div>
            </label>

            <label className="flex items-start gap-2 p-3 rounded-md bg-slate-50 border cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 mt-0.5 accent-primary"
                checked={form.mostrador}
                onChange={(e) => setForm({ ...form, mostrador: e.target.checked, clientInitiated: e.target.checked ? true : form.clientInitiated })}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Mostrador</span>
                <span className="text-[11px] text-slate-500">Consulta en sucursal (walk-in).</span>
              </div>
            </label>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Segmento</label>
            <Select value={form.segmento} onValueChange={(val) => setForm({ ...form, segmento: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar Segmento" />
              </SelectTrigger>
              <SelectContent>
                {segmentos.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentUser?.role === "Admin" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Asignar a</label>
              <Popover open={isSellerSearchOpen} onOpenChange={setIsSellerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {form.assignedTo
                      ? users.find(u => u.id === form.assignedTo)?.name || "Seleccionar vendedor"
                      : "Seleccionar vendedor"}
                    <Search className="w-4 h-4 ml-2 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[300px]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar vendedor..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron vendedores.</CommandEmpty>
                      <CommandGroup heading="Vendedores">
                        {users
                          .filter(u => {
                            const clientSucursalId = form.isExistingClient
                              ? clients.find(c => c.id === form.clientId)?.sucursalId
                              : null;
                            if (!clientSucursalId) return true;
                            // Normalize to ignore zero-padding mismatches ("0020" vs "20")
                            return norm(u.sucursalId) === norm(clientSucursalId);
                          })
                          .map(u => (
                            <CommandItem
                              key={u.id}
                              value={`${u.name} ${sucursales.find(s => s.id === u.sucursalId)?.name || ""}`}
                              onSelect={() => {
                                setForm({ ...form, assignedTo: u.id });
                                setIsSellerSearchOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{u.name}{u.role === "Admin" ? " (Admin)" : ""}</span>
                                <span className="text-xs text-slate-500">{sucursales.find(s => s.id === u.sucursalId)?.name || ""}</span>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isCreating} className="gap-2">
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Lead"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
