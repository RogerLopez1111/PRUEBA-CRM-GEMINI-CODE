/**
 * Pipeline (Kanban) tab — drag-and-drop board over the lead statuses.
 *
 * Owns the filter row (search, sucursal, segmento, origin checkboxes, month,
 * vendedor) plus the DnD context/sensors. Card click and drag-drop both
 * route through openStatusUpdate so the host App owns the status-update
 * dialog.
 */
import { useMemo, useState } from "react";
import { Clock, Filter } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { MESES } from "../../lib/helpers";
import { useAppData } from "../../state/AppDataContext";
import type { Lead, LeadStatus, User } from "../../types";

const STATUS_ACCENT: Record<LeadStatus, { bar: string; valueBg: string; valueText: string }> = {
  ASIGNADO:    { bar: "bg-slate-400",   valueBg: "bg-slate-50",   valueText: "text-slate-700"  },
  CONTACTADO:  { bar: "bg-blue-500",    valueBg: "bg-blue-50",    valueText: "text-blue-700"   },
  NEGOCIACION: { bar: "bg-purple-500",  valueBg: "bg-purple-50",  valueText: "text-purple-700" },
  COTIZADO:    { bar: "bg-orange-500",  valueBg: "bg-orange-50",  valueText: "text-orange-700" },
  FACTURADO:   { bar: "bg-indigo-500",  valueBg: "bg-indigo-50",  valueText: "text-indigo-700" },
  ENTREGADO:   { bar: "bg-emerald-500", valueBg: "bg-emerald-50", valueText: "text-emerald-700"},
  RECHAZADO:   { bar: "bg-red-500",     valueBg: "bg-red-50",     valueText: "text-red-700"    },
};

const STATUSES: LeadStatus[] = [
  "ASIGNADO", "CONTACTADO", "NEGOCIACION", "COTIZADO", "FACTURADO", "ENTREGADO", "RECHAZADO",
];

function SortableLeadCard({ lead, users, onUpdate }: { key?: string; lead: Lead; users: User[]; onUpdate: () => void }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const seller = lead.assignedTo ? users.find(u => u.id === lead.assignedTo) : null;
  const accent = STATUS_ACCENT[lead.status] || STATUS_ACCENT.ASIGNADO;

  const daysSince = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const isStale = (lead.status === "ASIGNADO" && daysSince >= 3) || (lead.status === "COTIZADO" && daysSince >= 5);
  const timeLabel = daysSince === 0 ? "Hoy" : daysSince === 1 ? "Ayer" : `${daysSince}d`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onUpdate(); }}
      className="relative bg-white rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors group overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent.bar}`} />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-sm text-slate-900 leading-tight line-clamp-2 group-hover:text-[#141456] transition-colors">
            {lead.company || lead.name}
          </h4>
          <span className={`shrink-0 text-[11px] font-semibold font-mono px-2 py-0.5 rounded-md ${accent.valueBg} ${accent.valueText}`}>
            ${lead.value.toLocaleString()}
          </span>
        </div>

        {(lead.segmento || lead.sucursal || lead.mostrador) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {lead.mostrador && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
                Mostrador
              </span>
            )}
            {lead.segmento && (
              <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                {lead.segmento}
              </span>
            )}
            {lead.sucursal && (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                {lead.sucursal}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0">
            {seller ? (
              <>
                <div
                  className="w-5 h-5 rounded-full bg-[#141456]/10 flex items-center justify-center text-[9px] font-bold text-[#141456] shrink-0"
                  title={seller.name}
                >
                  {seller.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] text-slate-600 truncate">{seller.name}</span>
              </>
            ) : (
              <span className="text-[10px] italic text-slate-400">Sin asignar</span>
            )}
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-medium shrink-0 ${isStale ? "text-red-500" : "text-slate-400"}`}>
            <Clock className="w-3 h-3" />
            <span>{timeLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ status, leads, users, onUpdate }: { key?: string; status: LeadStatus; leads: Lead[]; users: User[]; onUpdate: (lead: Lead) => void }) {
  const { setNodeRef } = useDroppable({ id: status });
  const columnLeads = leads.filter(l => l.status === status);

  return (
    <div className="flex-shrink-0 w-[260px] sm:w-72 md:w-80 flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-base text-brand-navy">{status}</h3>
          <Badge variant="secondary" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
            {columnLeads.length}
          </Badge>
        </div>
      </div>

      <SortableContext
        id={status}
        items={columnLeads.map(l => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="flex-1 rounded-xl p-2 space-y-3 border border-dashed border-[#141456]/20 min-h-[200px]"
          style={{ backgroundColor: "rgba(20,20,86,0.06)" }}
        >
          {columnLeads.map((lead) => (
            <SortableLeadCard
              key={lead.id}
              lead={lead}
              users={users}
              onUpdate={() => onUpdate(lead)}
            />
          ))}
          {columnLeads.length === 0 && (
            <div className="h-24 flex items-center justify-center text-xs text-slate-400 italic">
              No leads here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

interface KanbanTabProps {
  openStatusUpdate: (lead: Lead, newStatus?: LeadStatus) => void;
}

export function KanbanTab({ openStatusUpdate }: KanbanTabProps) {
  const { leads, users, sucursales, segmentos, currentUser } = useAppData();

  const [filterSeller, setFilterSeller] = useState<string>("all");
  const [filterSucursal, setFilterSucursal] = useState<string>("all");
  const [filterSegmento, setFilterSegmento] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  // Origin filters: off = no filter, on = require the flag. Mostrador implies
  // clientInitiated in data so combining them collapses to mostrador.
  const [filterClientInitiated, setFilterClientInitiated] = useState(false);
  const [filterMostrador, setFilterMostrador] = useState(false);
  const [filterNewClient, setFilterNewClient] = useState(false);

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    for (const l of leads) {
      const d = new Date(l.updatedAt);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [leads]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;
    let newStatus: LeadStatus | null = null;

    if (STATUSES.includes(overId as LeadStatus)) {
      newStatus = overId as LeadStatus;
    } else {
      const overLead = leads.find(l => l.id === overId);
      if (overLead) newStatus = overLead.status;
    }

    if (newStatus) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && lead.status !== newStatus) {
        openStatusUpdate(lead, newStatus);
      }
    }
  };

  const visibleLeads = useMemo(() => leads.filter(l => {
    if (currentUser?.role === "Seller") {
      if (l.assignedTo !== currentUser.id) return false;
    } else if (currentUser?.role === "Admin") {
      if (filterSeller !== "all") {
        if (filterSeller === "unassigned") {
          if (l.assignedTo) return false;
        } else if (l.assignedTo !== filterSeller) {
          return false;
        }
      }
    }

    if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.company.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterSucursal !== "all" && l.sucursal !== filterSucursal) return false;
    if (filterSegmento !== "all" && l.segmento !== filterSegmento) return false;

    // Month filter only applies to closed leads (ENTREGADO / RECHAZADO);
    // active leads always show so sellers keep them in sight until closed.
    if (filterMonth !== "all" && (l.status === "ENTREGADO" || l.status === "RECHAZADO")) {
      const d = new Date(l.updatedAt);
      if (isNaN(d.getTime())) return false;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (ym !== filterMonth) return false;
    }

    if (filterClientInitiated && !l.clientInitiated) return false;
    if (filterMostrador && !l.mostrador) return false;
    if (filterNewClient && !l.newClient) return false;

    return true;
  }), [leads, currentUser, filterSeller, search, filterSucursal, filterSegmento, filterMonth, filterClientInitiated, filterMostrador, filterNewClient]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pipeline de Ventas</h2>
          <p className="text-slate-500">Visión general de todos los leads activos en el pipeline.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full md:w-64 space-y-1">
            <p className="text-xs font-medium text-brand-gray ml-1">Buscar Leads</p>
            <div className="relative">
              <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar leads..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-brand-gray ml-1">Sucursal</p>
            <Select value={filterSucursal} onValueChange={setFilterSucursal}>
              <SelectTrigger className="w-[150px] h-9">
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
            <p className="text-xs font-medium text-brand-gray ml-1">Segmento</p>
            <Select value={filterSegmento} onValueChange={setFilterSegmento}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Todos los Segmentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Segmentos</SelectItem>
                {segmentos.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
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
          <div className="space-y-1">
            <p className="text-xs font-medium text-brand-gray ml-1">Mes</p>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Mes" />
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
          {currentUser?.role === "Admin" && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-brand-gray ml-1">Vendedor</p>
              <Select value={filterSeller} onValueChange={setFilterSeller}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Todos los Vendedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Vendedores</SelectItem>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {users
                    .filter(u => filterSucursal === "all" || u.sucursalId === sucursales.find(s => s.name === filterSucursal)?.id)
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 min-h-[600px] -mx-2 px-2 md:mx-0 md:px-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={visibleLeads}
              users={users}
              onUpdate={(lead) => openStatusUpdate(lead)}
            />
          ))}
          <DragOverlay>
            {activeId ? (
              <div className="bg-white p-4 rounded-lg border-2 border-primary w-80 opacity-90">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-sm text-primary">{leads.find(l => l.id === activeId)?.name}</h4>
                  <span className="text-[10px] font-mono font-bold text-slate-400">${leads.find(l => l.id === activeId)?.value.toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-500">{leads.find(l => l.id === activeId)?.company}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
}
