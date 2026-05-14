/**
 * Mis Leads tab — seller's personal list of leads assigned to them.
 *
 * Owns its own search + origin (cliente contactó / mostrador / cliente nuevo)
 * filters. Cross-cutting status updates route through openStatusUpdate so the
 * host App keeps owning the status-update dialog.
 */
import { useState } from "react";
import { Users, Clock, History, Filter, AlertCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { useAppData } from "../../state/AppDataContext";
import type { Lead, LeadStatus } from "../../types";
import { getStatusBadge } from "./getStatusBadge";

interface MyLeadsTabProps {
  openStatusUpdate: (lead: Lead, newStatus?: LeadStatus) => void;
}

export function MyLeadsTab({ openStatusUpdate }: MyLeadsTabProps) {
  const { leads, currentUser } = useAppData();

  const [search, setSearch] = useState("");
  const [filterClientInitiated, setFilterClientInitiated] = useState(false);
  const [filterMostrador, setFilterMostrador] = useState(false);
  const [filterNewClient, setFilterNewClient] = useState(false);

  const visibleLeads = leads.filter((l) => {
    if (l.assignedTo !== currentUser?.id) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.company.toLowerCase().includes(q)) return false;
    }
    if (filterClientInitiated && !l.clientInitiated) return false;
    if (filterMostrador && !l.mostrador) return false;
    if (filterNewClient && !l.newClient) return false;
    return true;
  });

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mis Leads Activos</h2>
          <p className="text-slate-500">Gestiona y actualiza el estado de los leads asignados a ti.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 w-full md:w-72">
            <p className="text-xs font-medium text-brand-gray ml-1">Buscar</p>
            <div className="relative">
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar cliente o empresa..."
                className="pl-9 h-9 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
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

      <div className="grid grid-cols-1 gap-4">
        {visibleLeads.length === 0 ? (
          <Card className="border-dashed border-2 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
              <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
              <p>{search ? "No se encontraron leads que coincidan con la búsqueda." : "Aún no tienes leads asignados."}</p>
            </CardContent>
          </Card>
        ) : (
          visibleLeads.map((lead) => (
            <Card key={lead.id} className="bg-white overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-slate-100 p-3 rounded-full">
                      <Users className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg">{lead.name}</h3>
                        {getStatusBadge(lead.status)}
                        {lead.mostrador && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase tracking-wide">Mostrador</Badge>
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">{lead.company} • {lead.email}</p>
                      <p className="text-primary font-mono font-bold mt-2">${lead.value.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="w-full sm:w-auto">
                      <p className="text-sm font-semibold text-brand-navy mb-1.5 ml-1">Actualizar estado</p>
                      <Select
                        value={lead.status}
                        onValueChange={(val) => openStatusUpdate(lead, val as LeadStatus)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Cambiar estado" />
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
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto mt-auto gap-2"
                      onClick={() => openStatusUpdate(lead)}
                    >
                      <History className="w-4 h-4" /> Historial
                    </Button>
                  </div>
                </div>
                <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-t">
                  <span className="text-xs text-slate-400">Última actualización: {new Date(lead.updatedAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>Activo por {Math.floor((new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))} días</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
